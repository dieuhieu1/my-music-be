# MyMusic — AWS Deployment Guide

> Domain: **dieuhieu24.me** (GoDaddy)  
> Chiến lược: EC2 Stop/Start + GoDaddy API tự động cập nhật DNS.  
> Không cần Elastic IP. Chạy khi cần demo, stop khi không dùng. Data không mất.

---

## Subdomains

| Service | URL |
|---------|-----|
| Web app | `https://dieuhieu24.me` |
| API | `https://api.dieuhieu24.me/api/v1` |
| Admin portal | `https://admin.dieuhieu24.me` |

---

## Kiến trúc

```
Internet
   │
   ▼
GoDaddy DNS (tự động cập nhật qua API sau mỗi lần start)
   │
   ▼
EC2 t3.small — 30 GB EBS gp3  (IP thay đổi mỗi lần start, DNS tự update)
├── nginx          (80/443 → reverse proxy)
├── nestjs api     (:3001)
├── next.js web    (:3000)
├── next.js admin  (:3002)
├── python dsp     (:5000)
├── postgresql     ← data lưu trên EBS (persist khi stop)
└── redis          ← data lưu trên EBS (persist khi stop)
```

**Chi phí (không có Elastic IP):**

| Trạng thái | Chi phí |
|-----------|---------|
| EC2 đang chạy (t3.small) | ~$0.023/giờ (~$0.55/ngày) |
| EC2 đã stop | $0 |
| EBS 30 GB gp3 | ~$2.40/tháng (luôn tính) |
| **Idle hoàn toàn** | **~$2.40/tháng** |
| **Chạy 8 giờ/ngày** | **~$6.50/tháng** |

---

## Thứ tự thực hiện

1. Lấy GoDaddy API Key
2. Tạo EC2 (không cần Elastic IP)
3. Trỏ DNS GoDaddy lần đầu (thủ công 1 lần)
4. Tạo ECR repositories
5. Build & push Docker images
6. Cài Docker trên EC2
7. Upload config files lên EC2
8. Bật systemd auto-start + auto DNS update
9. Lấy SSL certificate (Let's Encrypt)
10. Test toàn bộ URLs

---

## Bước 1 — Lấy GoDaddy API Key

```
Truy cập: https://developer.godaddy.com/keys
→ Create New API Key
→ Name: mymusic-dns
→ Environment: Production
→ Lưu lại: API_KEY và API_SECRET (chỉ hiển thị 1 lần)
```

---

## Bước 2 — Tạo EC2 Instance

**AWS Console → EC2 → Launch Instance:**

```
AMI:           Amazon Linux 2023
Instance type: t3.small (2 vCPU, 2 GB RAM)
Key pair:      Tạo mới → download file .pem → giữ cẩn thận
Storage:       30 GB gp3  (Delete on termination: YES — mặc định)
```

**IAM Role** — tạo role mới với 2 policy:
- `AmazonEC2ContainerRegistryReadOnly`
- `AmazonS3FullAccess` (hoặc custom policy cho 3 buckets)

**Security Group:**

| Type | Port | Source |
|------|------|--------|
| SSH | 22 | My IP |
| HTTP | 80 | 0.0.0.0/0 |
| HTTPS | 443 | 0.0.0.0/0 |

> Sau khi tạo, ghi lại **Instance ID** (dạng `i-xxxxxxxxxxxxxxxxx`).  
> Không cần Elastic IP.

---

## Bước 3 — Trỏ DNS GoDaddy lần đầu (thủ công 1 lần)

**GoDaddy → My Products → dieuhieu24.me → DNS → Manage**

Lấy Public IP của EC2 lần đầu từ AWS Console → EC2 → instance → **Public IPv4 address**.

Xóa các A record mặc định (nếu có), thêm:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<EC2_PUBLIC_IP>` | 600 |
| A | `www` | `<EC2_PUBLIC_IP>` | 600 |
| A | `api` | `<EC2_PUBLIC_IP>` | 600 |
| A | `admin` | `<EC2_PUBLIC_IP>` | 600 |

> Chỉ làm bước này **1 lần duy nhất**. Từ lần 2 trở đi, script tự cập nhật.  
> DNS lan truyền mất 5–30 phút. Kiểm tra: `nslookup dieuhieu24.me`

---

## Bước 4 — Tạo ECR Repositories

```bash
aws ecr create-repository --repository-name mymusic/api   --region ap-southeast-1
aws ecr create-repository --repository-name mymusic/web   --region ap-southeast-1
aws ecr create-repository --repository-name mymusic/admin --region ap-southeast-1
aws ecr create-repository --repository-name mymusic/dsp   --region ap-southeast-1
```

---

## Bước 5 — Build & Push Docker Images

```bash
# Login ECR (chạy từ máy local)
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin \
  <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com

ECR_BASE="<ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com"

# Build từ root monorepo
docker build -f apps/api/Dockerfile   --target prod -t $ECR_BASE/mymusic/api:latest .
docker build -f apps/web/Dockerfile   --target prod -t $ECR_BASE/mymusic/web:latest .
docker build -f apps/admin/Dockerfile --target prod -t $ECR_BASE/mymusic/admin:latest .
docker build -f apps/dsp/Dockerfile               -t $ECR_BASE/mymusic/dsp:latest apps/dsp/

# Push
docker push $ECR_BASE/mymusic/api:latest
docker push $ECR_BASE/mymusic/web:latest
docker push $ECR_BASE/mymusic/admin:latest
docker push $ECR_BASE/mymusic/dsp:latest
```

---

## Bước 6 — Cài Docker trên EC2

```bash
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>

sudo yum update -y
sudo yum install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user

# Docker Compose v2
sudo curl -L \
  "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout → login lại để group docker có hiệu lực
exit
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>

docker --version && docker-compose --version
```

---

## Bước 7 — Upload Config Files lên EC2

```bash
mkdir -p /home/ec2-user/mymusic/backups
cd /home/ec2-user/mymusic
```

### 7a. `docker-compose.prod.yml`

```yaml
version: "3.9"

networks:
  mymusic-net:
    driver: bridge

volumes:
  postgres_data:
  redis_data:

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: mymusic
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: mymusic_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - mymusic-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mymusic -d mymusic_db"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --appendfsync everysec
    volumes:
      - redis_data:/data
    networks:
      - mymusic-net
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      retries: 5

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on: [api, web, admin]
    networks:
      - mymusic-net

  api:
    image: <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/mymusic/api:latest
    restart: unless-stopped
    env_file: .env.prod
    environment:
      NODE_ENV: production
      DB_HOST: postgres
      REDIS_HOST: redis
      DSP_URL: http://dsp:5000
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - mymusic-net

  web:
    image: <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/mymusic/web:latest
    restart: unless-stopped
    env_file: .env.prod
    networks:
      - mymusic-net

  admin:
    image: <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/mymusic/admin:latest
    restart: unless-stopped
    env_file: .env.prod
    networks:
      - mymusic-net

  dsp:
    image: <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/mymusic/dsp:latest
    restart: unless-stopped
    networks:
      - mymusic-net
```

### 7b. `.env.prod`

```bash
# App
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://dieuhieu24.me

# PostgreSQL (chạy trong Docker)
DB_HOST=postgres
DB_PORT=5432
DB_USER=mymusic
DB_PASSWORD=CHANGE_ME_STRONG_PASSWORD
DB_NAME=mymusic_db

# Redis (chạy trong Docker)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT — generate: openssl rand -hex 32
JWT_ACCESS_SECRET=CHANGE_ME_64_CHAR_RANDOM_STRING
JWT_REFRESH_SECRET=CHANGE_ME_64_CHAR_RANDOM_STRING_2
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# AWS S3 — EC2 dùng IAM Role, không cần hardcode key
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET_AUDIO=mymusic-audio
AWS_S3_BUCKET_AUDIO_ENC=mymusic-audio-enc
AWS_S3_BUCKET_IMAGES=mymusic-images
AWS_S3_PRESIGN_EXPIRES_SEC=3600

# Gmail SMTP
GMAIL_USER=dieuhieu10h@gmail.com
GMAIL_APP_PASSWORD=YOUR_16_CHAR_APP_PASSWORD
MAIL_FROM=dieuhieu10h@gmail.com

# DSP
DSP_URL=http://dsp:5000

# Payment
VNPAY_HASH_SECRET=
MOMO_SECRET_KEY=

# AI (Phase 10)
ANTHROPIC_API_KEY=

# Frontend URLs
NEXT_PUBLIC_API_URL=https://api.dieuhieu24.me/api/v1
NEXT_PUBLIC_ADMIN_URL=https://admin.dieuhieu24.me
```

### 7c. `nginx.conf`

```nginx
events { worker_connections 1024; }

http {
  client_max_body_size 500M;

  upstream api   { server api:3001; }
  upstream web   { server web:3000; }
  upstream admin { server admin:3002; }

  # Redirect HTTP → HTTPS
  server {
    listen 80;
    server_name dieuhieu24.me www.dieuhieu24.me api.dieuhieu24.me admin.dieuhieu24.me;
    return 301 https://$host$request_uri;
  }

  # Web app
  server {
    listen 443 ssl;
    server_name dieuhieu24.me www.dieuhieu24.me;
    ssl_certificate     /etc/letsencrypt/live/dieuhieu24.me/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dieuhieu24.me/privkey.pem;
    location / {
      proxy_pass http://web;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }

  # API
  server {
    listen 443 ssl;
    server_name api.dieuhieu24.me;
    ssl_certificate     /etc/letsencrypt/live/dieuhieu24.me/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dieuhieu24.me/privkey.pem;
    location / {
      proxy_pass http://api;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_read_timeout 300s;
    }
  }

  # Admin portal
  server {
    listen 443 ssl;
    server_name admin.dieuhieu24.me;
    ssl_certificate     /etc/letsencrypt/live/dieuhieu24.me/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dieuhieu24.me/privkey.pem;
    location / {
      proxy_pass http://admin;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }
}
```

### nginx.conf tạm thời (HTTP only — dùng trước khi có SSL)

```nginx
events { worker_connections 1024; }

http {
  client_max_body_size 500M;

  upstream api   { server api:3001; }
  upstream web   { server web:3000; }
  upstream admin { server admin:3002; }

  server {
    listen 80;
    server_name dieuhieu24.me www.dieuhieu24.me;
    location / { proxy_pass http://web; proxy_set_header Host $host; }
  }

  server {
    listen 80;
    server_name api.dieuhieu24.me;
    location / {
      proxy_pass http://api;
      proxy_set_header Host $host;
      proxy_read_timeout 300s;
    }
  }

  server {
    listen 80;
    server_name admin.dieuhieu24.me;
    location / { proxy_pass http://admin; proxy_set_header Host $host; }
  }
}
```

### 7d. `update-dns.sh` — chạy tự động sau mỗi lần EC2 boot

```bash
#!/bin/bash
# /home/ec2-user/mymusic/update-dns.sh
# Tự động cập nhật GoDaddy DNS sau khi EC2 start

DOMAIN="dieuhieu24.me"
GD_API_KEY="YOUR_GODADDY_API_KEY"
GD_API_SECRET="YOUR_GODADDY_API_SECRET"

# Lấy public IP hiện tại của EC2
NEW_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

echo "[DNS] Updating $DOMAIN → $NEW_IP"

for SUBDOMAIN in "@" "www" "api" "admin"; do
  curl -s -X PUT \
    "https://api.godaddy.com/v1/domains/$DOMAIN/records/A/$SUBDOMAIN" \
    -H "Authorization: sso-key $GD_API_KEY:$GD_API_SECRET" \
    -H "Content-Type: application/json" \
    -d "[{\"data\": \"$NEW_IP\", \"ttl\": 600}]"
done

echo "[DNS] Done. New IP: $NEW_IP"
```

```bash
chmod +x /home/ec2-user/mymusic/update-dns.sh
```

---

## Bước 8 — Bật Systemd Auto-start + Auto DNS Update

```bash
sudo nano /etc/systemd/system/mymusic.service
```

```ini
[Unit]
Description=MyMusic App
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ec2-user/mymusic
ExecStartPre=/bin/bash -c 'aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com'
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStartPost=/bin/bash /home/ec2-user/mymusic/update-dns.sh
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable mymusic
sudo systemctl start mymusic

# Kiểm tra
sudo systemctl status mymusic
docker-compose -f docker-compose.prod.yml ps
```

**Từ giờ: Start EC2 → Docker Compose tự lên → DNS tự cập nhật → không cần làm gì thêm.**

---

## Bước 9 — SSL Certificate (Let's Encrypt — miễn phí)

DNS phải đã trỏ đúng vào EC2 trước khi chạy certbot.

```bash
sudo yum install -y certbot

# Tắt nginx tạm
docker-compose -f docker-compose.prod.yml stop nginx

# Lấy certificate
sudo certbot certonly --standalone \
  -d dieuhieu24.me \
  -d www.dieuhieu24.me \
  -d api.dieuhieu24.me \
  -d admin.dieuhieu24.me \
  --email dieuhieu10h@gmail.com \
  --agree-tos --non-interactive

# Bật lại nginx
docker-compose -f docker-compose.prod.yml start nginx

# Auto-renew mỗi tháng
echo "0 3 1 * * root certbot renew --quiet && docker-compose -f /home/ec2-user/mymusic/docker-compose.prod.yml restart nginx" | \
  sudo tee /etc/cron.d/certbot-renew
```

---

## Bước 10 — Scripts Stop/Start (chạy từ máy local)

Tạo `scripts/demo-start.sh`:

```bash
#!/bin/bash
set -e

INSTANCE_ID="i-xxxxxxxxxxxxxxxxx"   # thay bằng Instance ID thực
REGION="ap-southeast-1"

echo "[1/3] Starting EC2..."
aws ec2 start-instances --instance-ids $INSTANCE_ID --region $REGION > /dev/null

echo "[2/3] Waiting for instance to run..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region $REGION

echo "[3/3] Instance is running."
echo "      Docker Compose + DNS update đang chạy tự động trên EC2..."
echo "      App sẵn sàng sau ~3-4 phút."
echo ""
echo "  Web:   https://dieuhieu24.me"
echo "  API:   https://api.dieuhieu24.me/api/v1"
echo "  Admin: https://admin.dieuhieu24.me"
```

Tạo `scripts/demo-stop.sh`:

```bash
#!/bin/bash
INSTANCE_ID="i-xxxxxxxxxxxxxxxxx"
REGION="ap-southeast-1"

echo "Stopping EC2..."
aws ec2 stop-instances --instance-ids $INSTANCE_ID --region $REGION > /dev/null
echo "Done. Data preserved on EBS. Cost: ~$0.08/day (EBS only)."
```

```bash
chmod +x scripts/demo-start.sh scripts/demo-stop.sh
```

---

## Bước 11 — Database Backup

```bash
# SSH vào EC2 (lấy IP hiện tại từ AWS Console hoặc script bên dưới)
INSTANCE_ID="i-xxxxxxxxxxxxxxxxx"
IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)
ssh -i your-key.pem ec2-user@$IP

# Backup lên S3 (an toàn nhất)
docker exec mymusic-postgres pg_dump -U mymusic mymusic_db | \
  aws s3 cp - s3://mymusic-images/backups/db_$(date +%Y%m%d_%H%M).sql

# Backup local
docker exec mymusic-postgres pg_dump -U mymusic mymusic_db \
  > /home/ec2-user/mymusic/backups/backup_$(date +%Y%m%d_%H%M).sql

# Restore
docker exec -i mymusic-postgres psql -U mymusic mymusic_db \
  < /home/ec2-user/mymusic/backups/backup_YYYYMMDD_HHMM.sql
```

---

## Bước 12 — GitHub Actions CI/CD

Tạo `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-southeast-1

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build & Push images
        run: |
          ECR="${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.ap-southeast-1.amazonaws.com"
          docker build -f apps/api/Dockerfile   --target prod -t $ECR/mymusic/api:latest .
          docker build -f apps/web/Dockerfile   --target prod -t $ECR/mymusic/web:latest .
          docker build -f apps/admin/Dockerfile --target prod -t $ECR/mymusic/admin:latest .
          docker build -f apps/dsp/Dockerfile               -t $ECR/mymusic/dsp:latest apps/dsp/
          docker push $ECR/mymusic/api:latest
          docker push $ECR/mymusic/web:latest
          docker push $ECR/mymusic/admin:latest
          docker push $ECR/mymusic/dsp:latest

      - name: Get EC2 current IP
        run: |
          EC2_IP=$(aws ec2 describe-instances \
            --instance-ids ${{ secrets.EC2_INSTANCE_ID }} \
            --query 'Reservations[0].Instances[0].PublicIpAddress' \
            --output text)
          echo "EC2_HOST=$EC2_IP" >> $GITHUB_ENV

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ env.EC2_HOST }}
          username: ec2-user
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /home/ec2-user/mymusic
            aws ecr get-login-password --region ap-southeast-1 | \
              docker login --username AWS --password-stdin \
              ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.ap-southeast-1.amazonaws.com
            docker-compose -f docker-compose.prod.yml pull
            docker-compose -f docker-compose.prod.yml up -d --remove-orphans
            docker image prune -f
```

**GitHub Secrets cần thêm:**

| Secret | Giá trị |
|--------|---------|
| `AWS_ACCESS_KEY_ID` | IAM user key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret |
| `AWS_ACCOUNT_ID` | 12 số account ID |
| `EC2_INSTANCE_ID` | `i-xxxxxxxxxxxxxxxxx` (không đổi) |
| `EC2_SSH_KEY` | Nội dung file .pem |

> Không cần lưu IP vào secrets vì script tự lấy IP mới qua Instance ID.

---

## Quy tắc bắt buộc — Tránh mất data

```
✅ Chỉ dùng:            aws ec2 stop-instances      → tắt EC2, data giữ nguyên
❌ Tuyệt đối không dùng: aws ec2 terminate-instances → xóa cả EBS, mất data vĩnh viễn
```

Trong AWS Console:
- Nút **Stop** → an toàn
- Nút **Terminate** → mất data

---

## Luồng sử dụng hàng ngày

```
Trước demo:
  ./scripts/demo-start.sh
  → EC2 boot (~1 phút)
  → Docker Compose tự lên (~3 phút)
  → update-dns.sh tự cập nhật GoDaddy DNS
  → Mở https://dieuhieu24.me (chờ thêm ~5 phút nếu DNS chưa propagate)

Sau demo:
  ./scripts/demo-stop.sh
  → Data PostgreSQL + Redis vẫn còn trên EBS
  → Chỉ tốn ~$2.40/tháng khi idle
```

---

## Checklist Deploy Lần Đầu

- [ ] Lấy GoDaddy API Key + Secret từ developer.godaddy.com
- [ ] Tạo EC2 t3.small, 30 GB EBS, IAM Role (không cần Elastic IP)
- [ ] Ghi lại Instance ID
- [ ] Trỏ DNS GoDaddy thủ công lần đầu (4 A records → EC2 Public IP)
- [ ] Tạo 4 ECR repositories
- [ ] Build & push 4 Docker images (production target)
- [ ] SSH vào EC2, cài Docker + Docker Compose
- [ ] Tạo thư mục `/home/ec2-user/mymusic/`
- [ ] Upload `docker-compose.prod.yml`, `.env.prod`, `nginx.conf` (HTTP-only trước)
- [ ] Upload `update-dns.sh`, điền API Key vào trong file, `chmod +x`
- [ ] Cấu hình systemd service (có `ExecStartPost=update-dns.sh`)
- [ ] Chạy `docker-compose -f docker-compose.prod.yml up -d`
- [ ] Kiểm tra containers: `docker-compose -f docker-compose.prod.yml ps`
- [ ] Test: `curl http://api.dieuhieu24.me/api/v1/health`
- [ ] Lấy SSL certificate (certbot)
- [ ] Thay `nginx.conf` bằng bản HTTPS, restart nginx
- [ ] Test HTTPS: `https://dieuhieu24.me`
- [ ] Stop EC2 → Start lại → kiểm tra DNS tự cập nhật
- [ ] Backup DB lần đầu lên S3
- [ ] Setup `scripts/demo-start.sh` và `demo-stop.sh` trên máy local
- [ ] Setup GitHub Actions (tùy chọn)
