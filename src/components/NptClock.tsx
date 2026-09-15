import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export const NptClock: React.FC = () => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      // Real Nepal Standard Time (UTC+5:45)
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const nptDate = new Date(utc + (5.75 * 3600000));

      const day = nptDate.getDate().toString().padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[nptDate.getMonth()];
      const year = nptDate.getFullYear();

      let hours = nptDate.getHours();
      const minutes = nptDate.getMinutes().toString().padStart(2, '0');
      const seconds = nptDate.getSeconds().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 becomes 12
      const strHours = hours.toString().padStart(2, '0');

      setTimeStr(`${day} ${month} ${year} | ${strHours}:${minutes}:${seconds} ${ampm} NPT`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center space-x-2 bg-slate-900/90 border border-slate-700/60 px-3 py-1.5 rounded-lg text-xs font-mono text-emerald-400 shadow-inner">
      <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
      <span className="font-semibold tracking-wide">{timeStr || 'Syncing NPT...'}</span>
      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
    </div>
  );
};
