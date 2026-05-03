# MyMusic — AWS Deployment Guide

> Domain: **dieuhieu24.me** (GoDaddy)  
> Chiến lược: EC2 Stop/Start + GoDaddy API tự động cập nhật DNS.  
> Không cần Elastic IP. Chạy khi cần demo, stop khi không dùng. Data không mất.

---

## Subdomains

| Service      | URL                                |
| ------------ | ---------------------------------- |
| Web app      | `https://dieuhieu24.me`            |
| API          | `https://api.dieuhieu24.me/api/v1` |
| Admin portal | `https://admin.dieuhieu24.me`      |

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

S3 Buckets (AWS — dùng chung local + PROD):
├── mymusic-audio       ← audio files (streaming)
├── mymusic-audio-enc   ← encrypted .enc files (offline download)
├── mymusic-images      ← cover art + avatars
└── mymusic-backups     ← PostgreSQL backup (tách riêng)
```

**Chi phí (không có Elastic IP):**

| Trạng thái               | Chi phí                   |
| ------------------------ | ------------------------- |
| EC2 đang chạy (t3.small) | ~$0.023/giờ (~$0.55/ngày) |
| EC2 đã stop              | $0                        |
| EBS 30 GB gp3            | ~$2.40/tháng (luôn tính)  |
| **Idle hoàn toàn**       | **~$2.40/tháng**          |
| **Chạy 8 giờ/ngày**      | **~$6.50/tháng**          |

---

## Thứ tự thực hiện

1. Lấy GoDaddy API Key
2. Tạo EC2 (không cần Elastic IP)
3. Trỏ DNS GoDaddy lần đầu (thủ công 1 lần)
4. Tạo ECR repositories + S3 backup bucket
5. Build & push Docker images
6. Cài Docker trên EC2
7. Upload config files lên EC2
8. Bật systemd auto-start + auto DNS update
9. **Start Docker Compose — để TypeORM tạo schema**
10. **Export DB từ local + import lên PROD**
11. Lấy SSL certificate (Let's Encrypt)
12. Test toàn bộ URLs

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

**IAM Role** — tạo role mới với các policy:

- `AmazonEC2ContainerRegistryReadOnly`
- Custom inline policy cho S3 (4 buckets):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadBucket",
        "s3:HeadObject"
      ],
      "Resource": [
        "arn:aws:s3:::mymusic-audio/*",
        "arn:aws:s3:::mymusic-audio-enc/*",
        "arn:aws:s3:::mymusic-images/*",
        "arn:aws:s3:::mymusic-backups/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": [
        "arn:aws:s3:::mymusic-audio",
        "arn:aws:s3:::mymusic-audio-enc",
        "arn:aws:s3:::mymusic-images",
        "arn:aws:s3:::mymusic-backups"
      ]
    }
  ]
}
```

**Security Group:**

| Type  | Port | Source    |
| ----- | ---- | --------- |
| SSH   | 22   | My IP     |
| HTTP  | 80   | 0.0.0.0/0 |
| HTTPS | 443  | 0.0.0.0/0 |

> Sau khi tạo, ghi lại **Instance ID** (dạng `i-xxxxxxxxxxxxxxxxx`).  
> Không cần Elastic IP.

---

## Bước 3 — Trỏ DNS GoDaddy lần đầu (thủ công 1 lần)

**GoDaddy → My Products → dieuhieu24.me → DNS → Manage**

Lấy Public IP của EC2 lần đầu từ AWS Console → EC2 → instance → **Public IPv4 address**.

Xóa các A record mặc định (nếu có), thêm:

| Type | Name    | Value             | TTL |
| ---- | ------- | ----------------- | --- |
| A    | `@`     | `<EC2_PUBLIC_IP>` | 600 |
| A    | `www`   | `<EC2_PUBLIC_IP>` | 600 |
| A    | `api`   | `<EC2_PUBLIC_IP>` | 600 |
| A    | `admin` | `<EC2_PUBLIC_IP>` | 600 |

> Chỉ làm bước này **1 lần duy nhất**. Từ lần 2 trở đi, script tự cập nhật.  
> DNS lan truyền mất 5–30 phút. Kiểm tra: `nslookup dieuhieu24.me`

---

## Bước 4 — Tạo ECR Repositories + S3 Backup Bucket

```bash
# ECR repositories (chạy từ máy local)
aws ecr create-repository --repository-name mymusic/api   --region us-east-1
aws ecr create-repository --repository-name mymusic/web   --region us-east-1
aws ecr create-repository --repository-name mymusic/admin --region us-east-1
aws ecr create-repository --repository-name mymusic/dsp   --region us-east-1

# S3 backup bucket (tách riêng khỏi app buckets)
aws s3 mb s3://mymusic-backups --region us-east-1

# Tắt public access cho backup bucket
aws s3api put-public-access-block \
  --bucket mymusic-backups \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

---

## Bước 5 — Build & Push Docker Images

```bash
# Login ECR (chạy từ máy local)
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

ECR_BASE="<ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com"

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
    image: <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/mymusic/api:latest
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
    image: <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/mymusic/web:latest
    restart: unless-stopped
    env_file: .env.prod
    networks:
      - mymusic-net

  admin:
    image: <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/mymusic/admin:latest
    restart: unless-stopped
    env_file: .env.prod
    networks:
      - mymusic-net

  dsp:
    image: <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/mymusic/dsp:latest
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
AWS_REGION=us-east-1
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
VNPAY_RETURN_URL=https://dieuhieu24.me/vi/payment/vnpay
VNPAY_IPN_URL=https://api.dieuhieu24.me/api/v1/payment/vn-pay/ipn
MOMO_SECRET_KEY=

# AI (Phase 10)
ANTHROPIC_API_KEY=

# Frontend URLs
NEXT_PUBLIC_API_URL=https://api.dieuhieu24.me/api/v1
NEXT_PUBLIC_ADMIN_URL=https://admin.dieuhieu24.me
```

### 7c. `nginx.conf` (HTTP only — dùng trước khi có SSL)

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
    location / {
      proxy_pass http://web;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }

  server {
    listen 80;
    server_name api.dieuhieu24.me;
    location / {
      proxy_pass http://api;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_read_timeout 300s;
    }
  }

  server {
    listen 80;
    server_name admin.dieuhieu24.me;
    location / {
      proxy_pass http://admin;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }
}
```

### 7d. `nginx.conf` (HTTPS — dùng sau khi có SSL)

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
      proxy_set_header X-Forwarded-Proto https;
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
      proxy_set_header X-Forwarded-Proto https;
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
      proxy_set_header X-Forwarded-Proto https;
    }
  }
}
```

### 7e. `update-dns.sh` — chạy tự động sau mỗi lần EC2 boot

```bash
#!/bin/bash
# /home/ec2-user/mymusic/update-dns.sh

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
  echo "[DNS] Updated $SUBDOMAIN → $NEW_IP"
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
ExecStartPre=/bin/bash -c 'aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com'
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

## Bước 9 — Export DB từ local + Import lên PROD

> ⚠️ Bước này chỉ làm **1 lần duy nhất** khi deploy lần đầu.  
> Mục đích: copy toàn bộ data (artists, songs, users, genres...) từ local lên PROD.  
> S3 files (audio, images) **không cần migrate** vì local và PROD dùng cùng AWS S3 buckets.

### 9a. Trên máy local — Export data-only SQL

```bash
# Tìm tên container postgres đang chạy
docker ps | grep postgres

# Export DATA ONLY (không có CREATE TABLE — để TypeORM tự tạo schema)
docker exec mymusic-postgres \
  pg_dump \
  --username mymusic \
  --dbname mymusic_db \
  --no-owner \
  --no-acl \
  --data-only \
  --disable-triggers \
  --format=plain \
  > mymusic_data_$(date +%Y%m%d).sql

# Kiểm tra file có data không (phải > 0 dòng)
wc -l mymusic_data_$(date +%Y%m%d).sql
head -30 mymusic_data_$(date +%Y%m%d).sql
```

> **Tại sao `--data-only`?**  
> TypeORM `synchronize: true` đã tạo toàn bộ schema (tables, indexes, constraints) khi API start.  
> Nếu import cả schema lẫn data sẽ bị lỗi "table already exists".

### 9b. Trên máy local — Upload SQL lên S3 backup

```bash
DATE=$(date +%Y%m%d)

aws s3 cp mymusic_data_${DATE}.sql \
  s3://mymusic-backups/migration/initial_${DATE}.sql

echo "✅ Upload xong: s3://mymusic-backups/migration/initial_${DATE}.sql"
```

### 9c. Trên EC2 — Đảm bảo schema đã được tạo

```bash
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>
cd /home/ec2-user/mymusic

# Kiểm tra API đang chạy và healthy
docker-compose -f docker-compose.prod.yml ps

# Verify schema đã tồn tại (TypeORM đã tạo tables)
docker exec \
  $(docker-compose -f docker-compose.prod.yml ps -q postgres) \
  psql --username mymusic --dbname mymusic_db \
  -c "\dt" | head -30

# Phải thấy danh sách tables (users, songs, artist_profile, genres, ...)
# Nếu chưa thấy → chờ API start hoàn toàn rồi chạy lại
```

### 9d. Trên EC2 — Stop API, import data, restart

```bash
# Bước 1: Stop API container (giữ postgres chạy)
docker-compose -f docker-compose.prod.yml stop api web admin

# Bước 2: Download SQL từ S3
DATE=20260503  # thay bằng ngày thực tế, ví dụ: 20260428
aws s3 cp \
  s3://mymusic-backups/migration/initial_${DATE}.sql \
  ./initial.sql

# Kiểm tra file download đúng
wc -l initial.sql  # phải > 100 dòng

# Bước 3: Import data vào PostgreSQL
docker exec -i \
  $(docker-compose -f docker-compose.prod.yml ps -q postgres) \
  psql \
  --username mymusic \
  --dbname mymusic_db \
  < initial.sql

# Nếu thấy lỗi "duplicate key" → data đã tồn tại, bỏ qua
# Nếu thấy lỗi "relation does not exist" → schema chưa tạo, quay lại 9c

# Bước 4: Verify data đã vào
PSQL_CMD="docker exec $(docker-compose -f docker-compose.prod.yml ps -q postgres) psql --username mymusic --dbname mymusic_db"

$PSQL_CMD -c "SELECT COUNT(*) AS users        FROM users;"
$PSQL_CMD -c "SELECT COUNT(*) AS songs        FROM songs;"
$PSQL_CMD -c "SELECT COUNT(*) AS artists      FROM artist_profile;"
$PSQL_CMD -c "SELECT COUNT(*) AS genres       FROM genre;"
$PSQL_CMD -c "SELECT COUNT(*) AS playlists    FROM playlist;"

# So sánh số với local — phải khớp

# Bước 5: Start lại toàn bộ services
docker-compose -f docker-compose.prod.yml start api web admin

# Bước 6: Verify API healthy
sleep 10
curl http://localhost:3001/api/v1/health
```

### 9e. Xóa file SQL tạm trên EC2

```bash
# Xóa file SQL khỏi EC2 sau khi import xong (đã có backup trên S3)
rm /home/ec2-user/mymusic/initial.sql
echo "✅ Migration hoàn thành. File SQL đã xóa khỏi EC2."
```

---

## Bước 10 — SSL Certificate (Let's Encrypt — miễn phí)

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

# Thay nginx.conf bằng bản HTTPS (mục 7d)
cp nginx-https.conf /home/ec2-user/mymusic/nginx.conf

# Bật lại nginx
docker-compose -f docker-compose.prod.yml start nginx

# Auto-renew mỗi tháng
echo "0 3 1 * * root certbot renew --quiet && docker-compose -f /home/ec2-user/mymusic/docker-compose.prod.yml restart nginx" | \
  sudo tee /etc/cron.d/certbot-renew
```

---

## Bước 11 — Test toàn bộ URLs

```bash
# Health check
curl https://api.dieuhieu24.me/api/v1/health

# Web app
curl -I https://dieuhieu24.me

# Admin portal
curl -I https://admin.dieuhieu24.me

# Test login (thay email/password)
curl -X POST https://api.dieuhieu24.me/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"yourpassword"}' \
  | jq '.data.user.roles'
# Expected: ["ADMIN"]

# Test genres (data từ local phải có)
curl https://api.dieuhieu24.me/api/v1/genres \
  | jq '.data | length'
# Expected: 30 (số genres đã seed)
```

---

## Bước 12 — Scripts Stop/Start (chạy từ máy local)

Tạo `scripts/demo-start.sh`:

```bash
#!/bin/bash
set -e

INSTANCE_ID="i-xxxxxxxxxxxxxxxxx"   # thay bằng Instance ID thực
REGION="us-east-1"

echo "[1/3] Starting EC2..."
aws ec2 start-instances --instance-ids $INSTANCE_ID --region $REGION > /dev/null

echo "[2/3] Waiting for instance to run..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region $REGION

echo "[3/3] Instance is running."
echo "      Docker Compose + DNS update đang chạy tự động trên EC2..."
echo "      App sẵn sàng sau ~3-4 phút."
echo ""
echo "  Web:   https://dieuhieu24.me"
echo "  API:   https://api.dieuhieu24.me/api/v1/health"
echo "  Admin: https://admin.dieuhieu24.me"
```

Tạo `scripts/demo-stop.sh`:

```bash
#!/bin/bash
INSTANCE_ID="i-xxxxxxxxxxxxxxxxx"
REGION="us-east-1"

echo "Stopping EC2..."
aws ec2 stop-instances --instance-ids $INSTANCE_ID --region $REGION > /dev/null
echo "Done. Data preserved on EBS. Cost: ~$2.40/month (EBS only)."
```

```bash
chmod +x scripts/demo-start.sh scripts/demo-stop.sh
```

---

## Bước 13 — Database Backup định kỳ

```bash
# SSH vào EC2
INSTANCE_ID="i-xxxxxxxxxxxxxxxxx"
IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)
ssh -i your-key.pem ec2-user@$IP

# Backup lên S3 backup bucket (tách riêng khỏi app buckets)
docker exec \
  $(docker-compose -f docker-compose.prod.yml ps -q postgres) \
  pg_dump -U mymusic mymusic_db | \
  aws s3 cp - s3://mymusic-backups/scheduled/db_$(date +%Y%m%d_%H%M).sql

echo "✅ Backup saved to s3://mymusic-backups/scheduled/"

# Backup local (giữ 7 ngày gần nhất)
docker exec \
  $(docker-compose -f docker-compose.prod.yml ps -q postgres) \
  pg_dump -U mymusic mymusic_db \
  > /home/ec2-user/mymusic/backups/backup_$(date +%Y%m%d_%H%M).sql

# Xóa backup local cũ hơn 7 ngày
find /home/ec2-user/mymusic/backups/ \
  -name "backup_*.sql" -mtime +7 -delete

# Restore (khi cần)
# docker exec -i \
#   $(docker-compose -f docker-compose.prod.yml ps -q postgres) \
#   psql -U mymusic mymusic_db \
#   < /home/ec2-user/mymusic/backups/backup_YYYYMMDD_HHMM.sql
```

### Cron backup tự động hàng ngày lúc 2 AM

```bash
echo "0 2 * * * ec2-user docker exec \$(docker-compose -f /home/ec2-user/mymusic/docker-compose.prod.yml ps -q postgres) pg_dump -U mymusic mymusic_db | aws s3 cp - s3://mymusic-backups/scheduled/db_\$(date +\%Y\%m\%d_\%H\%M).sql" | \
  sudo tee /etc/cron.d/mymusic-backup
```

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
  → Mở https://dieuhieu24.me (chờ ~5 phút)

Sau demo:
  ./scripts/demo-stop.sh
  → Data PostgreSQL + Redis vẫn còn trên EBS
  → Chỉ tốn ~$2.40/tháng khi idle
```

---

## Checklist Deploy Lần Đầu

### Chuẩn bị (máy local)

- [ ] Lấy GoDaddy API Key + Secret từ developer.godaddy.com
- [ ] Tạo EC2 t3.small, 30 GB EBS, IAM Role (không cần Elastic IP)
- [ ] Ghi lại Instance ID
- [ ] Trỏ DNS GoDaddy thủ công lần đầu (4 A records → EC2 Public IP)
- [ ] Tạo 4 ECR repositories
- [ ] Tạo S3 bucket `mymusic-backups` (tách riêng)
- [ ] Build & push 4 Docker images (production target)

### Setup EC2

- [ ] SSH vào EC2, cài Docker + Docker Compose
- [ ] Tạo thư mục `/home/ec2-user/mymusic/backups/`
- [ ] Upload `docker-compose.prod.yml`
- [ ] Upload `.env.prod` (điền đầy đủ secrets)
- [ ] Upload `nginx.conf` (bản HTTP-only trước)
- [ ] Upload `update-dns.sh`, điền API Key, `chmod +x`
- [ ] Cấu hình systemd service
- [ ] Chạy `docker-compose -f docker-compose.prod.yml up -d`
- [ ] Kiểm tra containers: `docker-compose -f docker-compose.prod.yml ps`
- [ ] Test: `curl http://localhost:3001/api/v1/health`

### Migrate data từ local

- [ ] **Local:** Export data-only SQL (`--data-only --disable-triggers`)
- [ ] **Local:** Upload SQL lên `s3://mymusic-backups/migration/`
- [ ] **EC2:** Verify schema đã tạo (`\dt` trong psql)
- [ ] **EC2:** Stop api, web, admin containers
- [ ] **EC2:** Download SQL từ S3
- [ ] **EC2:** Import SQL vào postgres
- [ ] **EC2:** Verify counts khớp với local
- [ ] **EC2:** Start lại api, web, admin
- [ ] **EC2:** Xóa file SQL tạm

### SSL + Final test

- [ ] Lấy SSL certificate (certbot)
- [ ] Thay `nginx.conf` bằng bản HTTPS, restart nginx
- [ ] Test HTTPS: `https://dieuhieu24.me`
- [ ] Test admin: `https://admin.dieuhieu24.me`
- [ ] Test API login với admin account
- [ ] Stop EC2 → Start lại → kiểm tra DNS tự cập nhật
- [ ] Backup DB lần đầu lên S3
- [ ] Setup cron backup tự động
- [ ] Setup `scripts/demo-start.sh` và `demo-stop.sh` trên máy local
