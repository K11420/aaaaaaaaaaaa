# Cloudflare Error 1033 の対処

Error 1033 は「Argo Tunnel がオリジンに接続できない」ときに発生します。

## 対処済み: fmaps は lenovo トンネルで公開

**原因**: Cloudflare 側で `fmaps.schale41.jp` が **lenovo トンネル** (cd74940a-...) に紐づいているのに、fmaps 専用トンネル (6301da5b-...) だけ起動していたため、ルーティングが合わず 1033 になっていました。

**対応**: **config-lenovo.yml** のトンネルを起動するように変更しました。このトンネルで fmaps / lenovo / manage / connect を一括公開しています。

- 起動: `cd /home/kbt0/webapp && ./start-all.sh`
- 停止: `./stop-all.sh`

## 確認すること

1. **Flask が起動しているか**
   ```bash
   lsof -i :5000
   curl -I http://127.0.0.1:5000/
   ```

2. **lenovo トンネルが起動しているか**
   ```bash
   pgrep -af "cloudflared.*config-lenovo"
   # 1プロセスだけ出ればOK
   ```

3. **Cloudflare ダッシュボード**
   - Zero Trust: **Access** → **Tunnels** でトンネル (cd74940a-...) が「Connected」
   - **Public Hostname** で `fmaps.schale41.jp` がこのトンネルを指しているか

## 一括再起動

```bash
cd /home/kbt0/webapp
./stop-all.sh
sleep 3
./start-all.sh
```
