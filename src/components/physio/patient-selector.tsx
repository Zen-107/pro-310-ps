'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/lib/store';
import {
  UserCircle, ChevronRight, Activity, Stethoscope, LogIn,
} from 'lucide-react';

interface PatientOption {
  id: string;
  name: string;
  condition: string;
  age: number | null;
  gender: string;
}

export function PatientSelector() {
  const { currentPatientId, setCurrentPatientId } = useAppStore();
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/patients')
      .then(r => r.json())
      .then(d => { setPatients(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (currentPatientId) return null;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
          <Activity className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">ยินดีต้อนรับสู่ AI Physio</h2>
        <p className="text-muted-foreground mt-2">เลือกตัวตนของคุณเพื่อเริ่มต้นการฝึก</p>
      </div>

      <div className="max-w-md mx-auto space-y-3">
        {patients.map((p) => (
          <motion.button
            key={p.id}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setCurrentPatientId(p.id)}
            className="w-full text-left"
          >
            <Card className="hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <UserCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.age && <span className="text-xs text-muted-foreground">{p.age} ปี</span>}
                    {p.gender !== 'ไม่ระบุ' && <span className="text-xs text-muted-foreground">{p.gender}</span>}
                    {p.condition && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 truncate">{p.condition}</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}