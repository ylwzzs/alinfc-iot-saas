# API 文档

## 基础信息

**Base URL**: `https://alinfc.vercel.app`

**认证方式**: Bearer Token (JWT)

---

## 认证接口

### 管理员登录

```
POST /api/auth/admin/login
```

**请求体**:
```json
{
  "username": "admin",
  "password": "password"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "username": "admin",
      "realName": "系统管理员"
    }
  }
}
```

---

### 租户登录

```
POST /api/auth/tenant/login
```

**请求体**:
```json
{
  "tenantName": "租户名",
  "password": "password"
}
```

---

### 获取当前用户

```
GET /api/auth/user
Authorization: Bearer <token>
```

---

## 管理员接口

### 获取租户列表

```
GET /api/admin/tenants?page=1&pageSize=20&keyword=关键词
Authorization: Bearer <token>
```

---

### 创建租户

```
POST /api/admin/tenants
Authorization: Bearer <token>

{
  "name": "新租户",
  "contact_name": "联系人",
  "contact_phone": "13800138000"
}
```

---

### 获取概览数据

```
GET /api/admin/overview
Authorization: Bearer <token>
```

---

## 租户接口

### 获取租户信息

```
GET /api/tenant/info
Authorization: Bearer <token>
```

---

### 获取仪表盘数据

```
GET /api/tenant/dashboard
Authorization: Bearer <token>
```

---

### 获取设备列表

```
GET /api/tenant/devices?page=1&pageSize=20&sn=设备SN
Authorization: Bearer <token>
```

---

## 错误码

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未登录或 Token 过期 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |
