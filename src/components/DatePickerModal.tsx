import React, { useState, useRef, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Check, X, Trash2 } from 'lucide-react';

interface DatePickerModalProps {
  value: string;
  onChange: (val: string) => void;
  label: string;
  placeholder?: string;
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function parseDate(value: string) {
  if (!value) return { day: 0, month: 0, year: 0 };
  const [y, m, d] = value.split('-').map(Number);
  return { day: d || 0, month: m || 0, year: y || 0 };
}

function formatDate(day: number, month: number, year: number) {
  if (!day || !month || !year) return '';
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const yyyy = String(year).padStart(4, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function displayDate(value: string) {
  if (!value) return '';
  const [y, m, d] = value.split('-').map(Number);
  if (!d || !m || !y) return value;
  return `${d} ${SHORT_MONTHS[m - 1]} ${y}`;
}

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(month: number, year: number) {
  return new Date(year, month - 1, 1).getDay();
}

export default function DatePickerModal({ value, onChange, label, placeholder }: DatePickerModalProps) {
  const [open, setOpen] = useState(false);
  const parsed = parseDate(value);
  const [selDay, setSelDay] = useState(parsed.day);
  const [selMonth, setSelMonth] = useState(parsed.month || new Date().getMonth() + 1);
  const [selYear, setSelYear] = useState(parsed.year || new Date().getFullYear());
  const [manualInput, setManualInput] = useState(displayDate(value));
  const [viewMonth, setViewMonth] = useState(parsed.month || new Date().getMonth() + 1);
  const [viewYear, setViewYear] = useState(parsed.year || new Date().getFullYear());
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setManualInput(displayDate(value));
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.body.style.overflow = '';
    };
  }, [open]);

  function openModal() {
    const p = parseDate(value);
    setSelDay(p.day);
    setSelMonth(p.month || new Date().getMonth() + 1);
    setSelYear(p.year || new Date().getFullYear());
    setViewMonth(p.month || new Date().getMonth() + 1);
    setViewYear(p.year || new Date().getFullYear());
    setOpen(true);
  }

  function handleConfirm() {
    if (selDay && selMonth && selYear) {
      const formatted = formatDate(selDay, selMonth, selYear);
      onChange(formatted);
      setManualInput(displayDate(formatted));
    }
    setOpen(false);
  }

  function handleCancel() {
    setOpen(false);
  }

  function prevMonth() {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  function handleManualChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setManualInput(val);
    if (!val.trim()) {
      onChange('');
      return;
    }
    const parts = val.split(/[-/]/);
    if (parts.length === 3) {
      let d = 0, m = 0, y = 0;
      if (parts[0].length === 4) {
        y = parseInt(parts[0]); m = parseInt(parts[1]); d = parseInt(parts[2]);
      } else {
        d = parseInt(parts[0]); m = parseInt(parts[1]); y = parseInt(parts[2]);
        if (y < 100) y += 2000;
      }
      if (d && m && y && y > 1900) {
        onChange(formatDate(d, m, y));
      }
    }
  }

  function handleManualBlur() {
    if (!manualInput.trim()) {
      onChange('');
      return;
    }
    const parts = manualInput.split(/[-/]/);
    if (parts.length === 3) {
      let d = 0, m = 0, y = 0;
      if (parts[0].length === 4) {
        y = parseInt(parts[0]); m = parseInt(parts[1]); d = parseInt(parts[2]);
      } else {
        d = parseInt(parts[0]); m = parseInt(parts[1]); y = parseInt(parts[2]);
        if (y < 100) y += 2000;
      }
      if (d && m && y && y > 1900) {
        const formatted = formatDate(d, m, y);
        onChange(formatted);
        setManualInput(displayDate(formatted));
        return;
      }
    }
    setManualInput(displayDate(value));
  }

  const daysInMonth = getDaysInMonth(viewMonth, viewYear);
  const firstDay = getFirstDayOfMonth(viewMonth, viewYear);
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  return (
    <div className="relative">
      <label className="text-[9px] font-mono text-slate-600 uppercase tracking-wider block mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={manualInput}
          onChange={handleManualChange}
          onBlur={handleManualBlur}
          placeholder={placeholder || 'DD/MM/YYYY'}
          className="w-full text-[11px] bg-slate-950/80 border border-slate-800 rounded-lg py-2 px-2.5 text-slate-300 focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
        />
        {manualInput && (
          <button
            onClick={() => { onChange(''); setManualInput(''); }}
            className="absolute right-7 top-1/2 -translate-y-1/2 p-0.5 text-slate-600 hover:text-red-400 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <button onClick={openModal} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-[#D4AF37] transition-colors">
          <CalendarDays className="w-3.5 h-3.5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            ref={panelRef}
            className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-[380px] overflow-hidden"
            onMouseDown={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-200">{MONTHS[viewMonth - 1]}</span>
                <input
                  type="text"
                  value={viewYear}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                    if (v) setViewYear(parseInt(v));
                  }}
                  className="w-14 text-center text-sm font-semibold text-slate-200 bg-slate-800/60 border border-slate-700 rounded-lg py-1 focus:outline-none focus:border-[#D4AF37]/50"
                />
              </div>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 px-4 gap-0.5 mb-1">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-[10px] font-mono text-slate-600 text-center py-1">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 px-4 gap-0.5">
              {days.map((d, i) => {
                if (d === null) return <div key={`e-${i}`} />;
                const isSelected = d === selDay && viewMonth === selMonth && viewYear === selYear;
                const isToday = d === new Date().getDate() && viewMonth === new Date().getMonth() + 1 && viewYear === new Date().getFullYear();
                return (
                  <button
                    key={d}
                    onClick={() => {
                      setSelDay(d);
                      setSelMonth(viewMonth);
                      setSelYear(viewYear);
                    }}
                    className={`w-full aspect-square flex items-center justify-center text-xs rounded-lg transition-all ${
                      isSelected
                        ? 'bg-[#D4AF37] text-slate-950 font-bold shadow-lg shadow-[#D4AF37]/20'
                        : isToday
                        ? 'text-[#D4AF37] font-semibold border border-[#D4AF37]/30 hover:bg-[#D4AF37]/10'
                        : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>

            {/* Quick years */}
            <div className="flex gap-1.5 px-4 mt-3 overflow-x-auto pb-1">
              {Array.from({ length: 9 }, (_, i) => new Date().getFullYear() - 4 + i).map(y => (
                <button
                  key={y}
                  onClick={() => {
                    setViewYear(y);
                    setSelYear(y);
                  }}
                  className={`text-[10px] px-2 py-1 rounded-md whitespace-nowrap transition-colors ${
                    viewYear === y
                      ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/20'
                      : 'text-slate-500 hover:text-slate-300 border border-transparent'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-800/60 mt-2">
              {selDay && selMonth && selYear && (
                <span className="text-[11px] text-slate-500 font-mono flex-1">
                  Dipilih: {selDay} {SHORT_MONTHS[selMonth - 1]} {selYear}
                </span>
              )}
              <button
                onClick={handleCancel}
                className="text-[11px] px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800/60 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Batal
              </button>
              <button
                onClick={() => { onChange(''); setManualInput(''); setSelDay(0); setOpen(false); }}
                className="text-[11px] px-3 py-1.5 rounded-lg border border-red-900/50 text-red-400 hover:bg-red-950/50 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Hapus
              </button>
              <button
                onClick={handleConfirm}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-[#D4AF37] text-slate-950 font-semibold hover:bg-[#D4AF37]/90 transition-colors flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Pilih
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
