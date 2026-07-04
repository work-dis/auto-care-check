'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, ShieldAlert } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';

export default function SettingsPage() {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    timezone: 'UTC',
    defaultReminderTime: '09:00',
    quietHoursStart: '',
    quietHoursEnd: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadPreferences() {
      try {
        const res = await fetch('/api/me');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setFormData({
              timezone: data.user.timezone || 'UTC',
              defaultReminderTime: data.user.defaultReminderTime || '09:00',
              quietHoursStart: data.user.quietHoursStart || '',
              quietHoursEnd: data.user.quietHoursEnd || '',
            });
          }
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadPreferences();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSaving(true);

    const payload = {
      timezone: formData.timezone,
      defaultReminderTime: formData.defaultReminderTime,
      quietHoursStart: formData.quietHoursStart || null,
      quietHoursEnd: formData.quietHoursEnd || null,
    };

    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast('Настройки успешно сохранены', 'success');
      } else {
        const data = await res.json();
        setErrors(data.error?.fieldErrors || { general: data.error?.message || 'Не удалось обновить настройки' });
      }
    } catch (err) {
      console.error(err);
      setErrors({ general: 'Сетевая ошибка при сохранении' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-teal-500 border-neutral-800"></div>
      </div>
    );
  }

  const timezones = [
    { value: 'UTC', label: 'UTC (Всемирное время)' },
    { value: 'Europe/Moscow', label: 'Москва (MSK, UTC+3)' },
    { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
    { value: 'Europe/Samara', label: 'Самара (SAMT, UTC+4)' },
    { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (YEKT, UTC+5)' },
    { value: 'Asia/Omsk', label: 'Омск (OMST, UTC+6)' },
    { value: 'Asia/Novosibirsk', label: 'Новосибирск (KRAT, UTC+7)' },
    { value: 'Asia/Irkutsk', label: 'Иркутск (IRKT, UTC+8)' },
    { value: 'Asia/Yakutsk', label: 'Якутск (YAKT, UTC+9)' },
    { value: 'Asia/Vladivostok', label: 'Владивосток (VLAT, UTC+10)' },
    { value: 'Asia/Magadan', label: 'Магадан (SRET, UTC+11)' },
    { value: 'Asia/Kamchatka', label: 'Камчатка (PETT, UTC+12)' },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
          <Settings className="h-8 w-8 text-teal-400" />
          Настройки оповещений
        </h1>
        <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
          Настройте часовой пояс, тихие часы и стандартное время отправки уведомлений о регламентных работах вашего автомобиля.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {errors.general && (
          <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">
            <ShieldAlert className="h-5 w-5 text-red-400 shrink-0" />
            <span>{errors.general}</span>
          </div>
        )}

        {/* Panel Container */}
        <div className="rounded-xl border border-neutral-850 bg-[#121214] p-6 space-y-5">
          {/* Timezone */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
              Часовой пояс
            </label>
            <select
              value={formData.timezone}
              onChange={(e) => setFormData((prev) => ({ ...prev, timezone: e.target.value }))}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
            >
              {timezones.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            {errors.timezone && <p className="mt-1 text-xs text-red-400">{errors.timezone}</p>}
          </div>

          {/* Default Daily Reminder Time */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
              Стандартное время ежедневной проверки (ЧЧ:ММ)
            </label>
            <input
              type="time"
              value={formData.defaultReminderTime}
              onChange={(e) => setFormData((prev) => ({ ...prev, defaultReminderTime: e.target.value }))}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
              required
            />
            <p className="mt-1 text-[10px] text-neutral-500">
              Время, в которое воркер будет планировать отправку ежедневных напоминаний.
            </p>
            {errors.defaultReminderTime && <p className="mt-1 text-xs text-red-400">{errors.defaultReminderTime}</p>}
          </div>

          {/* Quiet Hours */}
          <div className="border-t border-neutral-900 pt-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white">Режим «Не беспокоить» (тихие часы)</h3>
              <p className="mt-1 text-xs text-neutral-400">
                Уведомления, сгенерированные в этот промежуток времени, будут отложены до окончания тихих часов.
              </p>
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div>
                <label className="block text-[10px] uppercase font-semibold text-neutral-500 mb-1.5">
                  Начало тихих часов
                </label>
                <input
                  type="time"
                  value={formData.quietHoursStart}
                  onChange={(e) => setFormData((prev) => ({ ...prev, quietHoursStart: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                />
                {errors.quietHoursStart && <p className="mt-1 text-xs text-red-400">{errors.quietHoursStart}</p>}
              </div>

              <div>
                <label className="block text-[10px] uppercase font-semibold text-neutral-500 mb-1.5">
                  Конец тихих часов
                </label>
                <input
                  type="time"
                  value={formData.quietHoursEnd}
                  onChange={(e) => setFormData((prev) => ({ ...prev, quietHoursEnd: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                />
                {errors.quietHoursEnd && <p className="mt-1 text-xs text-red-400">{errors.quietHoursEnd}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-teal-400 transition-colors disabled:opacity-55 cursor-pointer"
          >
            <Save className="h-4.5 w-4.5" />
            {isSaving ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
        </div>
      </form>
    </div>
  );
}
