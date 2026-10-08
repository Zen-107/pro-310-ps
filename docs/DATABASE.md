# คู่มือฐานข้อมูล AI Physio

คู่มือนี้อธิบายว่าฐานข้อมูลของโปรเจกต์ทำงานอย่างไร ใช้คำสั่งอะไรในงานประจำวัน เปลี่ยนโครงสร้างอย่างไรให้ปลอดภัย และแก้ปัญหาที่พบบ่อยอย่างไร
ถ้าไม่แน่ใจว่าฐานข้อมูลมีปัญหาตรงไหน ให้เริ่มที่ `bun run db:doctor` เสมอ

---

## 1. ภาพรวม: ข้อมูลเดินทางอย่างไร

```
หน้าเว็บ (React)  →  API route (src/app/api/**)  →  Prisma Client (src/lib/db.ts)  →  PostgreSQL 16 (Docker)
```

มีสามส่วนที่ต้องเข้าใจ:

| ส่วน | อยู่ที่ไหน | หน้าที่ |
|---|---|---|
| **Schema** | `prisma/schema.prisma` | ตัวจริงของโครงสร้าง: ตาราง คอลัมน์ ความสัมพันธ์ enum — แก้ที่นี่ที่เดียว |
| **Migrations** | `prisma/migrations/<เวลา>_<ชื่อ>/migration.sql` | ประวัติการเปลี่ยนโครงสร้างเป็น SQL ทีละขั้น ฐานข้อมูลทุกเครื่องเดินตามลำดับเดียวกัน |
| **Seed** | `prisma/seed.ts` (+ `prisma/demo-history.ts`) | ข้อมูลสาธิต: หน่วยงาน บัญชี ท่าออกกำลังกายพร้อมแหล่งอ้างอิง แผนการรักษา ประวัติการฝึกจำลอง |

Prisma ตรวจว่าฐานข้อมูลใช้ migration ไหนไปแล้วจากตาราง `_prisma_migrations` ในฐานข้อมูลเอง

ไฟล์ตั้งค่าอื่น ๆ:

| ไฟล์ | หน้าที่ |
|---|---|
| `.env` | `DATABASE_URL` ของเครื่องคุณ (ไม่ commit) — คัดลอกจาก `.env.example` |
| `prisma.config.ts` | บอก Prisma CLI ว่า schema/migrations/seed อยู่ไหน และโหลด `.env` |
| `docker-compose.yml` | PostgreSQL สำหรับพัฒนา: user/password `physio`, ฐานข้อมูล `ai_physio`, พอร์ต 5432 |

---

## 2. เริ่มต้นครั้งแรก (เครื่องใหม่)

```bash
bun install                      # ติดตั้ง dependencies + สร้าง Prisma Client
cp .env.example .env             # แล้วตั้ง NEXTAUTH_SECRET
bun run db:up                    # เปิด PostgreSQL ใน Docker (ต้องเปิด Docker Desktop ก่อน)
bun run db:migrate:deploy        # สร้างตารางทั้งหมดตาม migrations
bun run db:seed                  # ใส่ข้อมูลสาธิต (รหัสผ่านทุกบัญชี: physio-demo-2026)
bun run db:doctor                # ตรวจว่าทุกอย่างพร้อม
bun run dev
```

---

## 3. คำสั่งประจำวัน

| คำสั่ง | ใช้เมื่อ | ข้อมูลหายไหม |
|---|---|---|
| `bun run db:doctor` | **อะไรก็ตามที่ผิดปกติ** — ตรวจทีละขั้นและบอกคำสั่งแก้ | ไม่ (อ่านอย่างเดียว) |
| `bun run db:up` | เปิดเครื่องใหม่ / Docker เพิ่งเปิด | ไม่ |
| `bun run db:status` | ดูว่ามี migration ที่ยังไม่ได้ apply ไหม | ไม่ |
| `bun run db:migrate:deploy` | หลัง `git pull` ที่มี migration ใหม่ | ไม่ (apply อย่างเดียว) |
| `bun run db:migrate -- --name <ชื่อ>` | **คุณ** แก้ `schema.prisma` แล้วต้องการสร้าง migration ใหม่ | ไม่ ยกเว้นตรวจพบ drift (ดูหัวข้อ 6) |
| `bun run db:studio` | ดู/แก้ข้อมูลผ่านหน้าเว็บ (http://localhost:5555) | แก้ได้จริง ระวัง |
| `bun run db:backup` | ก่อนทำอะไรเสี่ยง (seed, reset, ลองของ) | ไม่ — สร้างไฟล์ใน `backups/` |
| `bun run db:seed` | อยากได้ข้อมูลสาธิตใหม่ทั้งหมด | **หมด** — ลบทุกตารางก่อนใส่ใหม่ |
| `bun run db:reset` | ฐานข้อมูลพัง/สับสน อยากเริ่มใหม่ (drop → migrate → seed) | **หมด** |

> กฎง่าย ๆ: คำสั่งที่ลบข้อมูล (`db:seed`, `db:reset`) ใช้กับฐานข้อมูลสาธิตเท่านั้น และรัน `db:backup` ก่อนถ้ามีข้อมูลที่อยากเก็บ

---

## 4. เปลี่ยนโครงสร้างฐานข้อมูลอย่างถูกวิธี

ตัวอย่าง: เพิ่มคอลัมน์ผลการรักษาให้แผนการรักษา (ทำจริงใน migration `20261007034452_prescription_outcome`)

1. **แก้ `prisma/schema.prisma`**
   ```prisma
   model Prescription {
     ...
     outcome     PrescriptionOutcome?   // ? = ไม่บังคับ → แถวเดิมไม่พัง
     outcomeAt   DateTime?
   }
   ```
2. **สร้าง migration** — Prisma เทียบ schema กับฐานข้อมูลแล้วเขียน SQL ให้
   ```bash
   bun run db:migrate -- --name prescription_outcome
   ```
3. **เปิดอ่าน `migration.sql` ที่ได้ทุกครั้ง** ต้องเห็นแค่สิ่งที่ตั้งใจ เช่น `ADD COLUMN` ถ้าเห็น `DROP COLUMN` / `DROP TABLE` ที่ไม่ได้ตั้งใจ ให้หยุดและแก้ schema ใหม่
4. **ใช้ค่าใหม่ในโค้ด** — Prisma Client ถูกสร้างใหม่อัตโนมัติ (ถ้า editor ยังฟ้อง type ให้ `bun run db:generate` แล้วรีสตาร์ท TS server)
5. **commit `schema.prisma` กับโฟลเดอร์ migration พร้อมกัน** เพื่อนในทีม `git pull` แล้วรัน `bun run db:migrate:deploy`

กฎที่ห้ามละเมิด:

- **ห้ามแก้หรือลบไฟล์ migration ที่ apply ไปแล้ว** (ทั้งในเครื่องตัวเองและของคนอื่น) อยากเปลี่ยนอะไรให้สร้าง migration ใหม่ทับ
- **เพิ่ม ดีกว่าเปลี่ยน**: คอลัมน์ใหม่ให้ใส่ `?` หรือ `@default(...)` เพื่อไม่ให้แถวเดิมผิดกฎ ถ้าจะลบหรือเปลี่ยนชื่อคอลัมน์ ให้คิดก่อนว่าข้อมูลเดิมจะไปไหน (enum `JointName` ยังเก็บค่าท่าที่เลิกใช้ไว้ด้วยเหตุผลนี้)
- **ห้ามรัน `db:migrate` (migrate dev) หรือ `db:reset` กับฐานข้อมูลจริง** — production ใช้ `db:migrate:deploy` อย่างเดียว

---

## 5. ตารางหลักและความสัมพันธ์

```mermaid
erDiagram
  Organization ||--o{ Clinician : employs
  Organization ||--o{ Patient : registers
  User ||--o| Clinician : "login of"
  User ||--o| Patient : "login of"
  Clinician ||--o{ CareAssignment : "care team"
  Patient ||--o{ CareAssignment : "care team"
  Patient ||--o{ Prescription : has
  Prescription ||--o{ PrescriptionItem : "exercises"
  PrescriptionItem ||--o{ Quest : "daily task"
  Quest ||--o| ExerciseSession : "done as"
  ExerciseSession ||--o{ SessionRep : reps
  ExerciseSession ||--o{ SessionFault : "form faults"
  ExerciseSession ||--o{ JointAngleLog : angles
  ExerciseSession ||--o| SessionReview : "clinician review"
  Patient ||--o{ CareMessage : "care-team chat"
```

- **สิทธิ์การเห็นข้อมูล** ไม่ได้อยู่ในฐานข้อมูล แต่อยู่ใน `src/lib/access.ts`: แพทย์เห็นเฉพาะผู้ป่วยที่มี `CareAssignment` กับตัวเอง ผู้ป่วยเห็นเฉพาะของตัวเอง ผู้ป่วยที่ถูก archive (`archivedAt`) ไม่แสดงในรายการใด ๆ
- **ข้อมูลทางการแพทย์ไม่ลบจริง**: ลบผู้ป่วย = ตั้ง `archivedAt` ยกเลิกแผน = `status: CANCELLED`
- **`ExerciseSession.targetSnapshot`** เก็บเป้าหมายและสูตรที่ใช้ตอนฝึก ทำให้รายงานย้อนหลังตรวจสอบได้แม้แพทย์จะเปลี่ยนเป้าหมายภายหลัง
- **`Prescription.outcome`** ผลการรักษาที่แพทย์บันทึกเมื่อจบแผน คือข้อมูลที่ใช้ฝึกแบบจำลองพยากรณ์ในอนาคต (ดูหัวข้อ 9)

---

## 6. แก้ปัญหาที่พบบ่อย

เริ่มจาก `bun run db:doctor` ก่อนเสมอ แล้วเทียบกับตารางนี้

| อาการ / รหัส | สาเหตุ | วิธีแก้ |
|---|---|---|
| `P1001 Can't reach database server` | Docker ไม่ได้เปิด, container ไม่ได้รัน หรือใช้ `localhost` บน Windows (Prisma ลอง IPv6 `::1`) | เปิด Docker Desktop → `bun run db:up` → ใช้ `127.0.0.1` ใน `DATABASE_URL` |
| `P1000 Authentication failed` | user/password ใน `DATABASE_URL` ไม่ตรงกับ container | ใช้ `physio:physio` ตาม `docker-compose.yml` |
| `P1003 Database does not exist` | ยังไม่ได้สร้างฐานข้อมูลชื่อนั้น | `bun run db:migrate:deploy` (สร้างให้) |
| `Environment variable not found: DATABASE_URL` | ไม่มี `.env` หรือรันคำสั่งผิดโฟลเดอร์ | `cp .env.example .env` และรันคำสั่งในโฟลเดอร์ `ai-physio` |
| `P3005 The database schema is not empty` | ฐานข้อมูลมีตารางอยู่แล้วแต่ไม่มีประวัติ migration (เช่น เคยใช้ `db push` หรือ SQLite เดิม) | ฐานข้อมูลสาธิต: `bun run db:reset` |
| `P3009 migrate found failed migrations` | migration ครั้งก่อนล้มกลางทาง | สาธิต: `bun run db:reset` · จริง: แก้สาเหตุ แล้ว `bunx prisma migrate resolve --rolled-back <ชื่อ>` |
| `Drift detected` ตอน `db:migrate` แล้วถามให้ reset | โครงสร้างในฐานข้อมูลไม่ตรงกับประวัติ migration (มีคนแก้ตารางเอง หรือสลับ branch ที่มี migration ต่างกัน) | ตอบ **No** ก่อน → `bun run db:backup` → ถ้าเป็นข้อมูลสาธิตค่อย `bun run db:reset` |
| หน้าเว็บ error ว่าไม่มีคอลัมน์/ตาราง หลัง `git pull` | ยังไม่ได้ apply migration ใหม่ | `bun run db:migrate:deploy` แล้วรีสตาร์ท `bun run dev` |
| TypeScript ฟ้องว่า field ไม่มีใน Prisma type | Prisma Client เก่ากว่า schema | `bun run db:generate` แล้วรีสตาร์ท TS server |
| `port is already allocated` ตอน `db:up` | มี Postgres ตัวอื่นใช้พอร์ต 5432 อยู่ (container อื่น หรือ PostgreSQL ที่ติดตั้งในเครื่อง) | `db:doctor` จะบอกชื่อ container ที่ชน → หยุด/ลบตัวที่ไม่ใช้ |
| เปลี่ยนชื่อ/ย้ายโฟลเดอร์แล้ว `db:up` ได้ฐานข้อมูลว่าง | Docker Compose ตั้งชื่อ project ตามชื่อโฟลเดอร์ | แก้แล้ว: `docker-compose.yml` ตรึง `name: pro-310-ps` ไว้ ใช้ container/volume เดิมเสมอ |
| ล็อกอินไม่ได้ทั้งที่รหัสถูก | ฐานข้อมูลว่าง (ยังไม่ seed) หรือ seed ด้วยรหัสอื่น | `bun run db:seed` (รหัสตาม `SEED_DEMO_PASSWORD`) |

---

## 7. สำรองและกู้คืน

```bash
bun run db:backup
# → backups/ai_physio-YYYYMMDD-HHMM.dump  (ไฟล์มีข้อมูลผู้ป่วย: อยู่ใน .gitignore ห้ามแชร์)
```

กู้คืน (เขียนทับข้อมูลปัจจุบันทั้งหมด):

```bash
docker exec -i pro-310-ps-db-1 pg_restore -U physio -d ai_physio --clean --if-exists < backups/<ไฟล์>.dump
```

---

## 8. ฐานข้อมูลสำหรับ integration test

เทสต์จะ **ลบข้อมูลทั้งหมด** ในฐานข้อมูลที่ใช้ จึงต้องแยกเป็นฐานข้อมูลที่ชื่อมีคำว่า `test` (ระบบปฏิเสธถ้าไม่ใช่)

```bash
docker exec pro-310-ps-db-1 psql -U physio -d ai_physio -c "CREATE DATABASE ai_physio_test;"
# ใส่ใน .env:
# TEST_DATABASE_URL="postgresql://physio:physio@127.0.0.1:5432/ai_physio_test?schema=public"
DATABASE_URL="$TEST_DATABASE_URL" bunx prisma migrate deploy     # ทุกครั้งที่มี migration ใหม่
bun run test:integration
```

---

## 9. ข้อมูลสำหรับ Predictive Analytics

| ข้อมูล | ใช้ทำอะไร |
|---|---|
| `ExerciseSession.romMinAngle/romMaxAngle` + `targetSnapshot` | คำนวณ "องศาที่ยังขาด" รายวัน → ประมาณการระยะฟื้นตัวรายบุคคล (`src/lib/recovery-forecast.ts`) |
| เซสชันของผู้ป่วยทุกคนในหน่วยงานเดียวกัน (รวมคนที่ archive แล้ว) | แบบจำลองประชากร: อัตราการฟื้นตัวตามปกติของท่านั้น (`src/lib/population-model.ts`) — ออกไปเฉพาะค่าสรุป ไม่มีข้อมูลรายคน |
| `Quest.status`, `CareMessage.escalated`, `SessionFault` | คะแนนเฝ้าระวัง: การฝึกตามแผน อาการที่ต้องประเมิน ท่าชดเชย (`src/lib/risk-score.ts`) |
| `Prescription.outcome` | ผลการรักษาจริง (label) — ส่งออกแบบไม่ระบุตัวตนที่ `GET /api/analytics/dataset` เพื่อฝึกและตรวจสอบแบบจำลองพยากรณ์ผลการรักษา/การบาดเจ็บซ้ำในอนาคต |

ข้อมูล seed ทุกแถวที่เป็นข้อมูลจำลองมีหมายเหตุ `ข้อมูลจำลองสำหรับสาธิต (seed)` และคอลัมน์ `simulated` ในไฟล์ส่งออก — ห้ามใช้ฝึกหรือประเมินแบบจำลองจริง
