# Milestone 03: Backend Architecture, Zod Validation Pipe & Auth Service

## 1. Objective
Establish the foundational NestJS backend structure, global validation pipe using Zod schemas, JWT authentication lifecycle, driver registration, and password hashing.

---

## 2. Scope & Target Files
- `/backend/src/main.ts`
- `/backend/src/app.module.ts`
- `/backend/src/common/pipes/zod-validation.pipe.ts`
- `/backend/src/common/interceptors/transform-response.interceptor.ts`
- `/backend/src/common/filters/http-exception.filter.ts`
- `/backend/src/modules/auth/auth.module.ts`
- `/backend/src/modules/auth/auth.controller.ts`
- `/backend/src/modules/auth/auth.service.ts`
- `/backend/src/modules/auth/jwt.strategy.ts`
- `/backend/src/modules/auth/guards/jwt-auth.guard.ts`
- `/backend/src/contracts/auth.contract.ts`

---

## 3. Detailed Technical Requirements

### 3.1 Global NestJS Bootstrap (`backend/src/main.ts`)
- Set global API prefix: `app.setGlobalPrefix('api/garage')`.
- Register global `ZodValidationPipe`.
- Register global `TransformResponseInterceptor` to enforce the standardized response envelope:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "data": {},
    "timestamp": "2026-09-15T12:00:00.000Z"
  }
  ```
- Register global `HttpExceptionFilter` to format errors uniformly:
  ```json
  {
    "success": false,
    "statusCode": 400,
    "error": "Bad Request",
    "message": ["Detailed validation error strings"],
    "timestamp": "2026-09-15T12:00:00.000Z"
  }
  ```
- Bind port to environment `PORT` (default 5742, non-standard to avoid collisions).

### 3.2 Zod Validation Pipe (`backend/src/common/pipes/zod-validation.pipe.ts`)
- Intercept incoming request payloads against passed Zod schemas.
- On validation failure, parse Zod `issues` into a clean array of field paths and error messages, throwing a NestJS `BadRequestException`.

### 3.3 Auth Module Contracts & Endpoints
1. **`POST /api/garage/auth/register`**
   - **Schema:**
     ```typescript
     export const UserRegistrationSchema = z.object({
       email: z.string().email(),
       password: z.string().min(8).max(100),
       callsign: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
     });
     ```
   - Hashes password using bcrypt or Argon2id.
   - Inserts record into `users` table.
   - Generates JWT containing `{ sub: user.id, callsign: user.callsign }`.
   - Returns status `201 Created` with token and user profile.

2. **`POST /api/garage/auth/login`**
   - Validates email and password against stored hash.
   - Returns status `200 OK` with signed JWT and user profile.
   - Rejects with `401 Unauthorized` on credential mismatch.

3. **`GET /api/garage/auth/me`**
   - Protected by `JwtAuthGuard`.
   - Extracts `user.id` from JWT payload.
   - Returns current user record along with total vehicle count and setup count.

---

## 4. Verification & Acceptance Criteria
1. Submitting malformed JSON or invalid schema properties returns `400 Bad Request` with field-level error messages in the standardized envelope.
2. Registration rejects duplicate emails or callsigns with `409 Conflict`.
3. Passwords are never returned in cleartext or logged in responses.
4. Calling `GET /api/garage/auth/me` without a valid `Authorization: Bearer <token>` header returns `401 Unauthorized`.
