
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';


interface Cemetery {
  id: string;
  name: string;
  address: string;
  rites: string[];
  basePrice: number;
}

interface Addon {
  code: string;
  label: string;
  price: number;
}

interface Slot {
  iso: string;
  label: string;
}

interface Plan {
  type: string;
  apr: number;
}

interface FormDataState {
  decFirst: string;
  decLast: string;
  decDob: string;
  decDod: string;
  decPlace: string;
  decReligion: string;
  decService: string;
  decNotes: string;
  famName: string;
  famRelation: string;
  famEmail: string;
  famPhone: string;
  famAddr: string;
  famConsent: boolean;
  signerName: string;
  apr: number;
}


const CEMETERIES: Cemetery[] = [
  {
    id: 'cem1',
    name: 'Green Meadow Cemetery',
    address: '100 Peace Ave, Brooklyn, NY',
    rites: ['Muslim', 'Christian', 'Jewish', 'Secular'],
    basePrice: 2400
  },
  {
    id: 'cem2',
    name: 'Hudson Rest Gardens',
    address: '22 River Rd, Jersey City, NJ',
    rites: ['Christian', 'Secular'],
    basePrice: 2100
  },
  {
    id: 'cem3',
    name: 'Everlight Memorial Park',
    address: '12 Sunrise Blvd, Queens, NY',
    rites: ['Muslim', 'Jewish', 'Secular'],
    basePrice: 2600
  }
];

const ADDONS: Addon[] = [
  { code: 'transport_basic', label: 'Transport (within city)', price: 250 },
  { code: 'transport_extended', label: 'Transport (extended radius)', price: 500 },
  { code: 'flowers', label: 'Floral arrangement', price: 180 },
  { code: 'clergy', label: 'Clergy/Officiant honorarium', price: 200 },
  { code: 'permits', label: 'Permits & admin fees', price: 120 },
  { code: 'viewing', label: 'Viewing room (2 hours)', price: 350 }
];

const STEPS = [
  { id: 1, label: 'Deceased', hint: 'Legal details' },
  { id: 2, label: 'Family', hint: 'Contact & consent' },
  { id: 3, label: 'Booking', hint: 'Cemetery & time' },
  { id: 4, label: 'Costs', hint: 'Add-ons & plan' },
  { id: 5, label: 'Paperwork', hint: 'Download pack' }
];


async function sha256(text: string) {
  try {

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const enc = new TextEncoder();
      const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
      return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {

  }


  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return `fallback-${Math.abs(hash)}`;
}

export default function OneSign() {
  const [currentStep, setCurrentStep] = useState(1);


  const [formData, setFormData] = useState<FormDataState>({
    decFirst: '',
    decLast: '',
    decDob: '',
    decDod: '',
    decPlace: '',
    decReligion: 'Muslim',
    decService: 'Burial',
    decNotes: '',
    famName: '',
    famRelation: '',
    famEmail: '',
    famPhone: '',
    famAddr: '',
    famConsent: false,
    signerName: '',
    apr: 0
  });


  const [cemSearch, setCemSearch] = useState('');
  const [selectedCemetery, setSelectedCemetery] = useState<Cemetery | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);


  const [pickedAddons, setPickedAddons] = useState<Set<string>>(new Set());
  const [plan, setPlan] = useState<Plan>({ type: 'full', apr: 0 });


  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [packHash, setPackHash] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');


  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: id === 'apr' ? Number(value) : value
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, checked } = e.target;
    setFormData(prev => ({ ...prev, [id]: checked }));
  };

  const handleAddonChange = (code: string, checked: boolean) => {
    const newSet = new Set(pickedAddons);
    if (checked) newSet.add(code);
    else newSet.delete(code);
    setPickedAddons(newSet);
  };


  useEffect(() => {
    const out: Slot[] = [];
    const now = new Date();
    for (let d = 0; d < 7; d++) {
      for (let h = 9; h <= 17; h += 2) {
        const dt = new Date(now);
        dt.setDate(now.getDate() + d);
        dt.setHours(h, 0, 0, 0);
        out.push({
          iso: dt.toISOString(),
          label: dt.toLocaleString([], {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          })
        });
      }
    }
    setSlots(out);
  }, []);


  const filteredCemeteries = useMemo(() => {
    const q = cemSearch.toLowerCase();
    return CEMETERIES.filter(
      c =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
    );
  }, [cemSearch]);


  const costs = useMemo(() => {
    const base = selectedCemetery ? selectedCemetery.basePrice : 0;
    const addonList = Array.from(pickedAddons)
      .map(code => ADDONS.find(a => a.code === code))
      .filter(Boolean) as Addon[];
    const addonsTotal = addonList.reduce((s, a) => s + a.price, 0);
    const subtotal = base + addonsTotal;
    const tax = Math.round(subtotal * 0.08875 * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    const n = plan.type === 'full' ? 1 : parseInt(plan.type, 10);
    const aprVal = formData.apr || 0;
    let schedule: number[] = [];

    if (n === 1) {
      schedule = [total];
    } else if (!aprVal) {
      const basePay = Math.floor((total / n) * 100) / 100;
      schedule = Array.from({ length: n }, () => basePay);
      const diff =
        Math.round((total - basePay * n) * 100) / 100;
      schedule[n - 1] = Math.round((schedule[n - 1] + diff) * 100) / 100;
    } else {
      const r = aprVal / 12 / 100;
      const pay =
        Math.round(
          (total * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)) * 100
        ) / 100;
      schedule = Array.from({ length: n }, () => pay);
    }

    return { base, addons: addonList, tax, total, schedule };
  }, [selectedCemetery, pickedAddons, plan, formData.apr]);


  const validateStep = (n: number) => {
    if (n === 1) {
      if (
        !formData.decFirst ||
        !formData.decLast ||
        !formData.decDob ||
        !formData.decDod
      )
        return false;
      if (new Date(formData.decDod) < new Date(formData.decDob)) return false;
    }
    if (n === 2) {
      if (
        !formData.famName ||
        !formData.famRelation ||
        !formData.famEmail ||
        !formData.famPhone ||
        !formData.famConsent
      )
        return false;
    }
    if (n === 3) {
      if (!selectedCemetery || !selectedSlot) return false;
    }
    return true;
  };

  const nextStep = () => {
    if (!validateStep(currentStep)) {
      alert('Please complete required fields.');
      return;
    }
    setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => setCurrentStep(prev => prev - 1);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';

    if (!hasSignature) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [currentStep, hasSignature]);

  const getXY = (
    e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX: number;
    let clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    const { x, y } = getXY(e);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    const { x, y } = getXY(e);
    ctx?.lineTo(x, y);
    ctx?.stroke();
    setHasSignature(true);
  };

  const stopDraw = () => setIsDrawing(false);

  const clearSig = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
    }
  };


  const generatePack = async () => {
    if (!formData.signerName) {
      alert('Enter signer name.');
      return;
    }
    if (!hasSignature) {
      alert('Please provide a signature.');
      return;
    }

    try {
      const snapshot = {
        deceased: {
          firstName: formData.decFirst,
          lastName: formData.decLast,
          dob: formData.decDob,
          dod: formData.decDod,
          placeOfDeath: formData.decPlace,
          religion: formData.decReligion,
          serviceType: formData.decService,
          notes: formData.decNotes
        },
        family: {
          name: formData.famName,
          relation: formData.famRelation,
          email: formData.famEmail,
          phone: formData.famPhone,
          address: formData.famAddr
        },
        booking: { cemetery: selectedCemetery, slotIso: selectedSlot },
        costs,
        signer: { name: formData.signerName, at: new Date().toISOString() }
      };

      const text = JSON.stringify(snapshot, null, 2);
      const hash = await sha256(text);
      setPackHash(hash);

      const doc = new jsPDF({ unit: 'pt', format: 'letter' });


      doc.setFontSize(18);
      doc.text('OneSign • Funeral Paperwork Pack', 40, 60);
      doc.setFontSize(11);
      doc.text(`Signer: ${formData.signerName}`, 40, 80);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 98);
      doc.text(`Integrity (SHA-256): ${hash}`, 40, 116, { maxWidth: 520 });


      doc.addPage();
      doc.setFontSize(14);
      doc.text('Summary', 40, 60);

      const summary = [
        ['Deceased', `${snapshot.deceased.firstName} ${snapshot.deceased.lastName}`],
        ['DOB', snapshot.deceased.dob],
        ['DOD', snapshot.deceased.dod],
        ['Place of death', snapshot.deceased.placeOfDeath],
        ['Rites', snapshot.deceased.religion],
        ['Service', snapshot.deceased.serviceType],
        ['Primary contact', `${snapshot.family.name} (${snapshot.family.relation})`],
        ['Email/Phone', `${snapshot.family.email} / ${snapshot.family.phone}`],
        ['Cemetery', snapshot.booking.cemetery ? snapshot.booking.cemetery.name : '—'],
        [
          'Slot',
          snapshot.booking.slotIso
            ? new Date(snapshot.booking.slotIso).toLocaleString()
            : '—'
        ]
      ];

      autoTable(doc, {
        head: [['Field', 'Value']],
        body: summary,
        startY: 80,
        theme: 'grid',
        styles: { fontSize: 9 }
      });


      doc.addPage();
      doc.setFontSize(14);
      doc.text('Costs & Payment Plan', 40, 60);

      const costBody: any[] = [];
      costBody.push(['Base', `$${costs.base.toFixed(2)}`]);
      costs.addons.forEach(a =>
        costBody.push([a.label, `$${a.price.toFixed(2)}`])
      );
      costBody.push(['Tax', `$${costs.tax.toFixed(2)}`]);
      costBody.push(['Total', `$${costs.total.toFixed(2)}`]);

      autoTable(doc, {
        head: [['Item', 'Amount']],
        body: costBody,
        startY: 80,
        theme: 'grid',
        styles: { fontSize: 9 }
      });

      const sched = costs.schedule.map((p, i) => [
        `Payment ${i + 1}`,
        `$${p.toFixed(2)}`
      ]);

      autoTable(doc, {
        head: [['Schedule', 'Amount']],
        body: sched,
        startY: (doc as any).lastAutoTable.finalY + 16,
        theme: 'grid',
        styles: { fontSize: 9 }
      });


      doc.addPage();
      doc.setFontSize(14);
      doc.text('Attestation & Signature', 40, 60);
      doc.setFontSize(10);
      doc.text(
        'I certify that I am authorized to make these arrangements and the information provided is accurate.',
        40,
        80,
        { maxWidth: 520 }
      );
      doc.setFontSize(11);
      doc.text(`Signed by: ${formData.signerName}`, 40, 110);

      const sigData = canvasRef.current?.toDataURL('image/png');
      if (sigData) {
        doc.addImage(sigData, 'PNG', 40, 130, 360, 110);
      }

      doc.setFontSize(8);
      doc.text(`Timestamp: ${new Date().toISOString()}`, 40, 258);


      doc.save('OneSign_Paperwork_Pack.pdf');


      const url = doc.output('bloburl') as unknown as string;
      setDownloadUrl(url);

      setCurrentStep(5);
    } catch (err) {
      console.error('[OneSign] Error while generating PDF', err);
      alert(
        'Error while generating PDF: ' +
          (err instanceof Error ? err.message : String(err))
      );
    }
  };

  const currency = (n: number) =>
    n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });


  const inputClass =
    'bg-transparent border-0 border-b border-slate-700 rounded-none px-0 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-0 focus:border-indigo-500 w-full';
  const btnPrimary =
    'inline-flex items-center justify-center px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 cursor-pointer';
  const btnGhost =
    'inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-800 bg-slate-950/30 hover:bg-slate-900/70 text-slate-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 cursor-pointer';
  const btnChip =
    'px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950/30 hover:bg-slate-900/70 text-slate-200 text-sm transition cursor-pointer';
  const btnChipActive =
    'px-3 py-1.5 rounded-xl border border-slate-800 bg-indigo-600 text-white text-sm transition cursor-pointer';

  return (
    <div className="w-full text-slate-100 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur mb-6 rounded-t-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600/20 ring-1 ring-indigo-600/30">
              <span className="text-indigo-400 font-black">O</span>
            </span>
            <div className="font-extrabold tracking-tight text-lg">
              OneSign
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-2 grid grid-cols-12 gap-6">
        {/* Sidebar Stepper */}
        <aside className="col-span-12 lg:col-span-4 xl:col-span-3">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900/80 to-slate-900/40">
              <div className="text-sm text-slate-400">Workflow</div>
              <div className="font-semibold">Arrange & Sign</div>
            </div>
            <nav className="p-2 space-y-1">
              {STEPS.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    if (s.id < currentStep) setCurrentStep(s.id);
                  }}
                  disabled={s.id > currentStep}
                  className={`w-full text-left rounded-xl p-3 border transition flex items-center gap-3 ${
                    currentStep === s.id
                      ? 'bg-slate-900/60 border-slate-700'
                      : 'border-transparent hover:border-slate-700/80'
                  }`}
                >
                  <span className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-800 text-sm">
                    {s.id}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">
                      {s.label}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {s.hint}
                    </span>
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content Area */}
        <div className="col-span-12 lg:col-span-8 xl:col-span-9 space-y-6">
          {/* STEP 1 */}
          {currentStep === 1 && (
            <section className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl">
              <header className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-300 font-bold">
                  1
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    Deceased Information
                  </h2>
                  <p className="text-xs text-slate-400">
                    Full legal details for the certificate
                  </p>
                </div>
              </header>
              <div className="p-6 grid md:grid-cols-2 gap-4">
                <input
                  id="decFirst"
                  className={inputClass}
                  placeholder="First name"
                  value={formData.decFirst}
                  onChange={handleInputChange}
                />
                <input
                  id="decLast"
                  className={inputClass}
                  placeholder="Last name"
                  value={formData.decLast}
                  onChange={handleInputChange}
                />
                <label className="text-xs text-slate-400">
                  Date of birth
                  <input
                    id="decDob"
                    type="date"
                    className={`${inputClass} mt-1`}
                    value={formData.decDob}
                    onChange={handleInputChange}
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Date of death
                  <input
                    id="decDod"
                    type="date"
                    className={`${inputClass} mt-1`}
                    value={formData.decDod}
                    onChange={handleInputChange}
                  />
                </label>
                <input
                  id="decPlace"
                  className={`${inputClass} md:col-span-2`}
                  placeholder="Place of death"
                  value={formData.decPlace}
                  onChange={handleInputChange}
                />
                <select
                  id="decReligion"
                  className={inputClass}
                  value={formData.decReligion}
                  onChange={handleInputChange}
                >
                  <option>Muslim</option>
                  <option>Christian</option>
                  <option>Jewish</option>
                  <option>Hindu</option>
                  <option>Buddhist</option>
                  <option>Secular</option>
                </select>
                <select
                  id="decService"
                  className={inputClass}
                  value={formData.decService}
                  onChange={handleInputChange}
                >
                  <option>Burial</option>
                  <option>Cremation</option>
                  <option>Other</option>
                </select>
                <textarea
                  id="decNotes"
                  className={`${inputClass} md:col-span-2 min-h-[96px]`}
                  placeholder="Notes (optional)"
                  value={formData.decNotes}
                  onChange={handleInputChange}
                />
              </div>
              <div className="px-6 pb-6 flex justify-end gap-2">
                <button className={btnPrimary} onClick={nextStep}>
                  Next
                </button>
              </div>
            </section>
          )}

          {/* STEP 2 */}
          {currentStep === 2 && (
            <section className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl">
              <header className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-300 font-bold">
                  2
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    Family Information
                  </h2>
                  <p className="text-xs text-slate-400">
                    Primary contact & authorization
                  </p>
                </div>
              </header>
              <div className="p-6 grid md:grid-cols-2 gap-4">
                <input
                  id="famName"
                  className={inputClass}
                  placeholder="Primary contact name"
                  value={formData.famName}
                  onChange={handleInputChange}
                />
                <input
                  id="famRelation"
                  className={inputClass}
                  placeholder="Relation (e.g., Son, Spouse)"
                  value={formData.famRelation}
                  onChange={handleInputChange}
                />
                <input
                  id="famEmail"
                  className={inputClass}
                  placeholder="Email"
                  value={formData.famEmail}
                  onChange={handleInputChange}
                />
                <input
                  id="famPhone"
                  className={inputClass}
                  placeholder="Phone"
                  value={formData.famPhone}
                  onChange={handleInputChange}
                />
                <input
                  id="famAddr"
                  className={`${inputClass} md:col-span-2`}
                  placeholder="Address"
                  value={formData.famAddr}
                  onChange={handleInputChange}
                />
                <label className="md:col-span-2 text-sm flex items-center gap-2 select-none cursor-pointer">
                  <input
                    id="famConsent"
                    type="checkbox"
                    className="accent-indigo-600"
                    checked={formData.famConsent}
                    onChange={handleCheckboxChange}
                  />
                  <span className="text-slate-300">
                    I am authorized to make arrangements and attest that
                    information is accurate.
                  </span>
                </label>
              </div>
              <div className="px-6 pb-6 flex justify-between gap-2">
                <button className={btnGhost} onClick={prevStep}>
                  Back
                </button>
                <button className={btnPrimary} onClick={nextStep}>
                  Next
                </button>
              </div>
            </section>
          )}

          {/* STEP 3 */}
          {currentStep === 3 && (
            <section className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl">
              <header className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-300 font-bold">
                  3
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    Cemetery Map & Calendar
                  </h2>
                  <p className="text-xs text-slate-400">
                    Choose a location and time
                  </p>
                </div>
              </header>
              <div className="p-6 grid md:grid-cols-3 gap-4">
                <div>
                  <input
                    className={inputClass}
                    placeholder="Search cemeteries"
                    value={cemSearch}
                    onChange={e => setCemSearch(e.target.value)}
                  />
                  <div className="mt-3 space-y-2 max-h-72 overflow-auto pr-1">
                    {filteredCemeteries.map(c => (
                      <button
                        key={c.id}
                        className={`w-full text-left border rounded-xl p-3 transition ${
                          selectedCemetery?.id === c.id
                            ? 'border-indigo-600 bg-slate-800'
                            : 'border-slate-800 hover:border-indigo-600/60 hover:bg-slate-900/70'
                        }`}
                        onClick={() => {
                          setSelectedCemetery(c);
                          setSelectedSlot(null);
                        }}
                      >
                        <div className="font-medium text-slate-200">
                          {c.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {c.address}
                        </div>
                        <div className="text-xs text-slate-400">
                          Rites: {c.rites.join(', ')}
                        </div>
                        <div className="text-xs text-slate-300 mt-1">
                          Base: ${c.basePrice.toFixed(2)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-sm text-slate-400">
                    {selectedCemetery
                      ? `Available times for ${selectedCemetery.name}`
                      : 'Select a cemetery to view available times.'}
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-auto pr-1 mt-2">
                    {selectedCemetery &&
                      slots.map(s => (
                        <button
                          key={s.iso}
                          className={`border rounded-xl p-2 text-left transition text-sm ${
                            selectedSlot === s.iso
                              ? 'bg-indigo-600 text-white border-transparent'
                              : 'border-slate-800 hover:bg-slate-900/70 text-slate-300'
                          }`}
                          onClick={() => setSelectedSlot(s.iso)}
                        >
                          {s.label}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
              <div className="px-6 pb-6 flex justify-between gap-2">
                <button className={btnGhost} onClick={prevStep}>
                  Back
                </button>
                <button className={btnPrimary} onClick={nextStep}>
                  Next
                </button>
              </div>
            </section>
          )}

          {/* STEP 4 */}
          {currentStep === 4 && (
            <section className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl">
              <header className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-300 font-bold">
                  4
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    Cost Calculator & Payment Plan
                  </h2>
                  <p className="text-xs text-slate-400">
                    Configure services and terms
                  </p>
                </div>
              </header>
              <div className="p-6 grid md:grid-cols-2 gap-6">
                <div>
                  <div className="p-4 border border-slate-800 rounded-xl bg-slate-950/40 mb-3">
                    <div className="font-medium text-slate-200">
                      Base package
                    </div>
                    <div className="text-sm text-slate-400">
                      {selectedCemetery?.name || 'No selection'}
                    </div>
                    <div className="text-2xl font-semibold mt-1 text-slate-100">
                      {currency(costs.base)}
                    </div>
                  </div>
                  <div className="font-medium mb-2 text-slate-200">
                    Add-ons
                  </div>
                  <div className="space-y-2">
                    {ADDONS.map(a => (
                      <label
                        key={a.code}
                        className="flex items-center gap-3 text-sm p-2 rounded hover:bg-slate-900/60 transition cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="accent-indigo-600"
                          checked={pickedAddons.has(a.code)}
                          onChange={e =>
                            handleAddonChange(a.code, e.target.checked)
                          }
                        />
                        <span className="text-slate-300">
                          {a.label} — {currency(a.price)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="p-4 border border-slate-800 rounded-xl bg-slate-950/40 space-y-2">
                    <div className="flex justify-between text-sm text-slate-300">
                      <span>Subtotal</span>
                      <span>{currency(costs.total - costs.tax)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-300">
                      <span>Tax & fees</span>
                      <span>{currency(costs.tax)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-xl pt-1 text-slate-100">
                      <span>Total</span>
                      <span>{currency(costs.total)}</span>
                    </div>
                  </div>
                  <div className="mt-4 p-4 border border-slate-800 rounded-xl bg-slate-950/40 space-y-3">
                    <div className="font-medium text-slate-200">
                      Payment plan
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {['full', '3', '6', '12'].map(p => (
                        <button
                          key={p}
                          className={
                            plan.type === p ? btnChipActive : btnChip
                          }
                          onClick={() => setPlan({ ...plan, type: p })}
                        >
                          {p === 'full' ? 'Pay in full' : `${p} months`}
                        </button>
                      ))}
                    </div>
                    <div className="text-sm flex items-center gap-2 mt-1">
                      <label className="text-slate-300">APR%</label>
                      <input
                        id="apr"
                        type="number"
                        className="bg-transparent border-b border-slate-600 w-16 text-center focus:outline-none"
                        value={formData.apr}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="mt-2 text-sm">
                      <div className="font-medium mb-1 text-slate-300">
                        Schedule
                      </div>
                      <ul className="list-disc pl-5 space-y-1 text-slate-400">
                        {costs.schedule.map((amt, i) => (
                          <li key={i}>
                            Payment {i + 1}: {currency(amt)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 space-y-3">
                <div className="font-medium text-slate-200">
                  Review & Sign
                </div>
                <input
                  id="signerName"
                  className={inputClass}
                  placeholder="Signer full name"
                  value={formData.signerName}
                  onChange={handleInputChange}
                />
                <div className="space-y-2">
                  <div className="text-sm text-slate-400">
                    Signature (draw below)
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={520}
                    height={160}
                    className="border border-slate-800 rounded bg-white w-full max-w-lg touch-none"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={stopDraw}
                  />
                  <div className="flex gap-2 items-center">
                    <button className={btnGhost} onClick={clearSig}>
                      Clear
                    </button>
                    {hasSignature && (
                      <span className="text-xs text-green-400">
                        Signature captured
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6">
                <div className="sticky bottom-4 flex justify-between gap-2">
                  <button className={btnGhost} onClick={prevStep}>
                    Back
                  </button>
                  <button className={btnPrimary} onClick={generatePack}>
                    Generate Paperwork Pack
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* STEP 5 */}
          {currentStep === 5 && (
            <section className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl">
              <header className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-300 font-bold">
                  5
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    Paperwork Pack Ready
                  </h2>
                  <p className="text-xs text-slate-400">Download & share</p>
                </div>
              </header>
              <div className="p-6 space-y-3">
                <div className="text-sm text-slate-300">
                  Your signed paperwork pack has been generated.
                </div>
                <div className="text-xs text-slate-400">
                  Hash (SHA-256):{' '}
                  <span className="font-mono break-all text-slate-500">
                    {packHash}
                  </span>
                </div>
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    download="OneSign_Paperwork_Pack.pdf"
                    className={btnPrimary}
                  >
                    Download Pack Again
                  </a>
                )}
              </div>
              <div className="px-6 pb-6 flex justify-between pt-2">
                <button
                  className={btnGhost}
                  onClick={() => window.location.reload()}
                >
                  Start Over
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
