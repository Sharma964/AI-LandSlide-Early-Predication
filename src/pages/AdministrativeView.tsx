import React, { useState, useEffect } from 'react';
import { Province, District } from '../types';
import { fetchProvinces, fetchDistricts } from '../services/api';
import { MapPin, Search, ChevronRight, Navigation } from 'lucide-react';

interface AdminProps {
  onSelectDistrictForPrediction: (dist: District) => void;
}

export const AdministrativeView: React.FC<AdminProps> = ({ onSelectDistrictForPrediction }) => {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedProvId, setSelectedProvId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchProvinces().then(p => {
      setProvinces(p);
      if (p.length > 0) setSelectedProvId(p[0].id);
    });
    fetchDistricts().then(setDistricts);
  }, []);

  const filteredDistricts = districts.filter(d => {
    const matchesProv = selectedProvId ? d.province_id === selectedProvId : true;
    const matchesSearch = d.title_en.toLowerCase().includes(search.toLowerCase()) ||
                          d.title.toLowerCase().includes(search.toLowerCase());
    return matchesProv && matchesSearch;
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
          <MapPin className="w-5 h-5 text-emerald-400" />
          <span>Nepal Administrative Directory (7 Provinces & 77 Districts)</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Complete geospatial mapping of official federal administrative boundaries of Nepal.
        </p>
      </div>

      {/* Province Selector Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedProvId(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
            selectedProvId === null
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          All 77 Districts
        </button>
        {provinces.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedProvId(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              selectedProvId === p.id
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {p.title_en} {p.title_ne ? `(${p.title_ne})` : ''}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Filter districts by name (e.g. Sindhupalchok, Kaski, Jhapa)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Districts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredDistricts.map((d) => {
          const prov = provinces.find(p => p.id === d.province_id);
          return (
            <div
              key={d.id}
              className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between group shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    ID #{d.id}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium">
                    {prov?.title_en || `Prov ${d.province_id}`}
                  </span>
                </div>
                <h4 className="text-base font-bold text-white mt-2 group-hover:text-emerald-400 transition">
                  {d.title_en}
                </h4>
                {d.title_ne && <p className="text-xs text-slate-500">{d.title_ne}</p>}
                
                <div className="mt-3 text-[11px] text-slate-400 font-mono space-y-0.5">
                  <div>Centroid Lat: {d.centroid[1]?.toFixed(4)}° N</div>
                  <div>Centroid Lon: {d.centroid[0]?.toFixed(4)}° E</div>
                </div>
              </div>

              <button
                onClick={() => onSelectDistrictForPrediction(d)}
                className="mt-4 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 hover:text-white border border-slate-700 text-xs font-medium text-slate-300 transition flex items-center justify-center space-x-1"
              >
                <span>Run Prediction</span>
                <Navigation className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
