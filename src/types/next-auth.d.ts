import type { UserRole } from '@prisma/client';

// Fields added to the next-auth session/JWT by src/lib/auth.ts
interface AppAuthFields {
  role: UserRole;
  clinicianId: string | null;
  patientId: string | null;
  organizationId: string | null;
  /** Adult who switched to this child ("play as …"); leaving kid mode returns to them */
  returnUserId: string | null;
  returnName: string | null;
}

declare module 'next-auth' {
  interface User extends AppAuthFields {
    id: string;
  }

  interface Session {
    user: AppAuthFields & {
      id: string;
      name: string;
      email: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: AppAuthFields['role'];
    clinicianId: AppAuthFields['clinicianId'];
    patientId: AppAuthFields['patientId'];
    organizationId: AppAuthFields['organizationId'];
    returnUserId?: AppAuthFields['returnUserId'];
    returnName?: AppAuthFields['returnName'];
  }
}
