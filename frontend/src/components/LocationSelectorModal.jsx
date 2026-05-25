import React, { memo, useMemo, useState } from 'react';
import { useLocationContext } from '../context/LocationContext';

const PAKISTAN_LOCATIONS = {
    Punjab: ['Lahore', 'Rawalpindi', 'Faisalabad', 'Multan', 'Gujranwala'],
    Sindh: ['Karachi', 'Hyderabad', 'Sukkur'],
    'Khyber Pakhtunkhwa': ['Peshawar', 'Mardan', 'Abbottabad'],
    Balochistan: ['Quetta', 'Gwadar'],
    'Islamabad Capital Territory': ['Islamabad'],
    'Gilgit-Baltistan': ['Gilgit', 'Skardu'],
    'Azad Jammu & Kashmir': ['Muzaffarabad', 'Mirpur']
};

const LocationSelectorModal = () => {
    const { selectorOpen, setSelectorOpen, setLocation, location, hydrated } = useLocationContext();
    const [province, setProvince] = useState(location?.province || '');
    const [city, setCity] = useState(location?.city || '');

    const provinces = useMemo(() => Object.keys(PAKISTAN_LOCATIONS), []);
    const cities = useMemo(() => (province ? PAKISTAN_LOCATIONS[province] : []), [province]);

    if (!hydrated || !selectorOpen) return null;

    const canSave = Boolean(province) && Boolean(city);

    const closeIfAllowed = () => {
        if (location?.province && location?.city) setSelectorOpen(false);
    };

    const handleSave = () => {
        if (!canSave) return;
        setLocation({ province, city });
        setSelectorOpen(false);
    };

    const quickPick = (p, c) => {
        setProvince(p);
        setCity(c);
        setLocation({ province: p, city: c });
        setSelectorOpen(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={closeIfAllowed} />
            <div className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden animate-scale-in">
                <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50/40">
                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Where should we deliver?</h2>
                    <p className="text-gray-600 font-medium mt-2">
                        Select your location in <span className="font-black text-gray-900">Pakistan</span> to see restaurants near you.
                    </p>
                </div>

                <div className="p-6 sm:p-8 space-y-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Province</label>
                            <select
                                value={province}
                                onChange={(e) => {
                                    setProvince(e.target.value);
                                    setCity('');
                                }}
                                className="input-field"
                            >
                                <option value="">Select province…</option>
                                {provinces.map((p) => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">City</label>
                            <select
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                className="input-field"
                                disabled={!province}
                            >
                                <option value="">{province ? 'Select city…' : 'Choose province first'}</option>
                                {cities.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => quickPick('Sindh', 'Karachi')} className="btn bg-gray-100 text-gray-800 hover:bg-gray-200 text-sm py-2">Karachi</button>
                        <button onClick={() => quickPick('Punjab', 'Lahore')} className="btn bg-gray-100 text-gray-800 hover:bg-gray-200 text-sm py-2">Lahore</button>
                        <button onClick={() => quickPick('Islamabad Capital Territory', 'Islamabad')} className="btn bg-gray-100 text-gray-800 hover:bg-gray-200 text-sm py-2">Islamabad</button>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            onClick={closeIfAllowed}
                            className="btn btn-outline"
                            disabled={!(location?.province && location?.city)}
                            title={location?.province && location?.city ? 'Close' : 'Please select your location first'}
                        >
                            Not now
                        </button>
                        <button
                            onClick={handleSave}
                            className="btn btn-primary"
                            disabled={!canSave}
                        >
                            Save location
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(LocationSelectorModal);

