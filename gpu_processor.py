# -*- coding: utf-8 -*-
"""
GPU画像処理モジュール - CUDA対応 + リアルタイムモニタリング
"""
import torch
import torch.nn.functional as F
import numpy as np
import cv2
import time
import subprocess
import psutil

class GPUImageProcessor:
    """GPU(CUDA)を使用した高速画像処理クラス"""
    
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.use_gpu = torch.cuda.is_available()
        self.gpu_available = self.use_gpu
        self.gpu_name = ""
        self.last_processing_time = 0
        self.processing_count = 0
        
        print(f"処理デバイス: {self.device}")
        if self.use_gpu:
            self.gpu_name = torch.cuda.get_device_name(0)
            print(f"   GPU: {self.gpu_name}")
    
    def get_nvidia_smi_stats(self):
        """nvidia-smiからリアルタイムGPU統計を取得"""
        try:
            result = subprocess.run([
                'nvidia-smi', 
                '--query-gpu=utilization.gpu,utilization.memory,memory.used,memory.total,temperature.gpu,power.draw',
                '--format=csv,noheader,nounits'
            ], capture_output=True, text=True, timeout=5)
            
            if result.returncode == 0:
                parts = result.stdout.strip().split(', ')
                return {
                    'gpu_utilization': float(parts[0]),
                    'memory_utilization': float(parts[1]),
                    'memory_used_mb': float(parts[2]),
                    'memory_total_mb': float(parts[3]),
                    'temperature_c': float(parts[4]),
                    'power_draw_w': float(parts[5]) if parts[5] != '[N/A]' else 0
                }
        except Exception as e:
            print(f"nvidia-smi error: {e}")
        return None
    
    def get_cpu_stats(self):
        """CPU使用率を取得"""
        try:
            cpu_percent = psutil.cpu_percent(interval=0.1)
            cpu_freq = psutil.cpu_freq()
            memory = psutil.virtual_memory()
            
            return {
                'cpu_utilization': cpu_percent,
                'cpu_freq_mhz': cpu_freq.current if cpu_freq else 0,
                'cpu_cores': psutil.cpu_count(),
                'ram_used_gb': round(memory.used / (1024**3), 2),
                'ram_total_gb': round(memory.total / (1024**3), 2),
                'ram_percent': memory.percent
            }
        except Exception as e:
            print(f"CPU stats error: {e}")
            return {
                'cpu_utilization': 0,
                'cpu_freq_mhz': 0,
                'cpu_cores': 0,
                'ram_used_gb': 0,
                'ram_total_gb': 0,
                'ram_percent': 0
            }
    
    def get_gpu_status(self):
        """現在のGPU・CPU使用状況を取得"""
        # CPU stats
        cpu_stats = self.get_cpu_stats()
        
        if not self.use_gpu:
            return {
                "gpu_available": False,
                "device": "cpu",
                "message": "CPU処理モード",
                **cpu_stats
            }
        
        # Get real GPU stats from nvidia-smi
        nvidia_stats = self.get_nvidia_smi_stats()
        
        # Also get PyTorch memory info
        try:
            torch_allocated = torch.cuda.memory_allocated() / 1024**2
            torch_reserved = torch.cuda.memory_reserved() / 1024**2
        except:
            torch_allocated = 0
            torch_reserved = 0
        
        if nvidia_stats:
            return {
                "gpu_available": True,
                "device": "cuda",
                "gpu_name": self.gpu_name,
                # Real-time from nvidia-smi
                "gpu_utilization": nvidia_stats['gpu_utilization'],
                "memory_utilization": nvidia_stats['memory_utilization'],
                "memory_used_mb": nvidia_stats['memory_used_mb'],
                "memory_total_mb": nvidia_stats['memory_total_mb'],
                "memory_usage_percent": round((nvidia_stats['memory_used_mb'] / nvidia_stats['memory_total_mb']) * 100, 1),
                "temperature_c": nvidia_stats['temperature_c'],
                "power_draw_w": nvidia_stats['power_draw_w'],
                # PyTorch specific
                "torch_allocated_mb": round(torch_allocated, 2),
                "torch_reserved_mb": round(torch_reserved, 2),
                # Processing stats
                "processing_count": self.processing_count,
                "last_processing_time_ms": round(self.last_processing_time * 1000, 2),
                # CPU stats
                **cpu_stats
            }
        else:
            return {
                "gpu_available": True,
                "device": "cuda",
                "gpu_name": self.gpu_name,
                "gpu_utilization": 0,
                "memory_used_mb": torch_allocated,
                "memory_total_mb": torch.cuda.get_device_properties(0).total_memory / 1024**2,
                "processing_count": self.processing_count,
                "last_processing_time_ms": round(self.last_processing_time * 1000, 2),
                **cpu_stats
            }
    
    def to_tensor(self, image):
        """NumPy画像をGPUテンソルに変換"""
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        tensor = torch.from_numpy(gray.astype(np.float32)).to(self.device)
        return tensor
    
    def to_numpy(self, tensor):
        """テンソルをNumPy配列に変換"""
        return tensor.cpu().numpy().astype(np.uint8)
    
    def gpu_otsu_threshold(self, image):
        """GPU版大津の二値化"""
        start = time.time()
        
        tensor = self.to_tensor(image)
        
        hist = torch.histc(tensor, bins=256, min=0, max=255)
        hist = hist / hist.sum()
        
        bin_centers = torch.arange(256, device=self.device, dtype=torch.float32)
        
        weight1 = torch.cumsum(hist, dim=0)
        weight2 = 1.0 - weight1
        
        mean1 = torch.cumsum(hist * bin_centers, dim=0) / (weight1 + 1e-10)
        mean2 = (torch.sum(hist * bin_centers) - torch.cumsum(hist * bin_centers, dim=0)) / (weight2 + 1e-10)
        
        variance = weight1 * weight2 * (mean1 - mean2) ** 2
        threshold = torch.argmax(variance).item()
        
        binary = (tensor > threshold).float() * 255
        
        result = self.to_numpy(binary)
        elapsed = time.time() - start
        self.last_processing_time = elapsed
        self.processing_count += 1
        print(f"GPU大津二値化: {elapsed*1000:.2f}ms (閾値={threshold})")
        
        return int(threshold), result
    
    def gpu_adaptive_threshold(self, image, block_size=11, c=2):
        """GPU版適応的二値化"""
        start = time.time()
        
        tensor = self.to_tensor(image)
        
        pad = block_size // 2
        padded = F.pad(tensor.unsqueeze(0).unsqueeze(0), (pad, pad, pad, pad), mode='reflect')
        
        kernel = torch.ones(1, 1, block_size, block_size, device=self.device) / (block_size * block_size)
        local_mean = F.conv2d(padded, kernel).squeeze()
        
        binary = (tensor > (local_mean - c)).float() * 255
        
        result = self.to_numpy(binary)
        elapsed = time.time() - start
        self.last_processing_time = elapsed
        self.processing_count += 1
        print(f"GPU適応的二値化: {elapsed*1000:.2f}ms")
        
        return result
    
    def gpu_gaussian_blur(self, image, kernel_size=5, sigma=1.0):
        """GPU版ガウシアンブラー"""
        start = time.time()
        
        tensor = self.to_tensor(image)
        
        x = torch.arange(kernel_size, device=self.device) - kernel_size // 2
        kernel_1d = torch.exp(-x**2 / (2 * sigma**2))
        kernel_1d = kernel_1d / kernel_1d.sum()
        kernel_2d = kernel_1d.unsqueeze(1) * kernel_1d.unsqueeze(0)
        kernel_2d = kernel_2d.unsqueeze(0).unsqueeze(0)
        
        pad = kernel_size // 2
        padded = F.pad(tensor.unsqueeze(0).unsqueeze(0), (pad, pad, pad, pad), mode='reflect')
        blurred = F.conv2d(padded, kernel_2d).squeeze()
        
        result = self.to_numpy(blurred)
        elapsed = time.time() - start
        self.last_processing_time = elapsed
        self.processing_count += 1
        
        return result
    
    def gpu_morphology(self, image, operation='close', kernel_size=3, iterations=1):
        """GPU版モルフォロジー演算"""
        start = time.time()
        
        tensor = self.to_tensor(image)
        tensor = tensor / 255.0
        
        pad = kernel_size // 2
        
        for _ in range(iterations):
            padded = F.pad(tensor.unsqueeze(0).unsqueeze(0), (pad, pad, pad, pad), mode='constant', value=0 if operation in ['dilate', 'close'] else 1)
            
            if operation == 'dilate' or (operation == 'close' and _ == 0) or (operation == 'open' and _ == iterations - 1):
                unfold = F.unfold(padded, kernel_size)
                tensor = unfold.max(dim=1)[0].view(tensor.shape)
            else:
                unfold = F.unfold(padded, kernel_size)
                tensor = unfold.min(dim=1)[0].view(tensor.shape)
        
        result = self.to_numpy(tensor * 255)
        elapsed = time.time() - start
        self.last_processing_time = elapsed
        self.processing_count += 1
        
        return result
    
    def process_image_full(self, image, method='otsu'):
        """画像の完全GPU処理パイプライン"""
        start = time.time()
        
        denoised = self.gpu_gaussian_blur(image, kernel_size=3, sigma=0.5)
        
        if method == 'otsu':
            threshold, binary = self.gpu_otsu_threshold(denoised)
        elif method == 'adaptive':
            binary = self.gpu_adaptive_threshold(denoised)
            threshold = -1
        else:
            threshold, binary = self.gpu_otsu_threshold(denoised)
        
        cleaned = self.gpu_morphology(binary, operation='close', kernel_size=3)
        
        total_time = time.time() - start
        print(f"GPU全処理完了: {total_time*1000:.2f}ms")
        
        return {
            'binary': cleaned,
            'threshold': threshold,
            'processing_time_ms': round(total_time * 1000, 2),
            'device': str(self.device)
        }

# グローバルインスタンス
gpu_processor = GPUImageProcessor()
