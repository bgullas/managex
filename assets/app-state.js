/* ManAgeX shared client-side state layer.
   Vanilla JS store backed by localStorage. Loaded by both index.html and resident-app.html.
   Both documents share the same localStorage origin (GitHub Pages), so data created in one
   is visible in the other on next load/refresh. */
(function (global) {
  const STORAGE_KEY = 'managex_state_v1';
  const CUR_USER_KEY = 'managex_cur_user';

  function seed() {
    return {
      units: [
        { unit: '#02-14', owner: 'Rajesh Kumar', email: 'rajesh.k@email.com', phone: '+65 9876 5432', occType: 'Owner-occupied', residents: 4, residentsNote: 'spouse, 2 children', monthlyFee: 850, feeStatus: 'Paid' },
        { unit: '#04-22', owner: 'Lee Hwee Leng', email: 'hwee.leng@gmail.com', phone: '+65 8234 5678', occType: 'Renting out', residents: 2, residentsNote: 'tenants', monthlyFee: 850, feeStatus: 'Partial' },
        { unit: '#07-08', owner: 'Noor Fadhilah', email: 'noor.f@proton.me', phone: '+65 9345 6789', occType: 'Owner-occupied', residents: 5, residentsNote: 'spouse, 2 child, DW', monthlyFee: 850, feeStatus: 'Paid' },
        { unit: '#11-03', owner: 'Chen Wei Liang', email: 'cwl@outlook.sg', phone: '+65 9555 1212', occType: 'Owner overseas', residents: 3, residentsNote: 'renting family', monthlyFee: 850, feeStatus: 'Overdue' },
        { unit: '#12-17', owner: 'Arjun Sharma', email: 'arjun.sg@icloud.com', phone: '+65 9888 4411', occType: 'Owner-occupied', residents: 2, residentsNote: 'spouse', monthlyFee: 850, feeStatus: 'Paid' },
      ],
      pendingApprovals: [
        { id: 'app1', type: 'Car registration', unit: '#08-14', detail: 'Log card uploaded', when: '2h ago' },
        { id: 'app2', type: 'New tenant', unit: '#04-22', detail: 'Tenancy agreement', when: '5h ago' },
        { id: 'app3', type: 'Sub-tenant', unit: '#11-08', detail: 'Relationship: Renting', when: '1d ago' },
        { id: 'app4', type: 'Car reg', unit: '#02-33', detail: 'Log card uploaded', when: '2d ago' },
      ],
      pendingTenants: [
        { id: 'pt1', name: 'Tan Kim Seng', role: 'Sub-tenant', unit: '#04-22', detail: 'Relationship: Renting · Tenancy agreement uploaded', when: '5 hours ago', av: 'TK', avClass: 'av-g' },
        { id: 'pt2', name: 'Muhammad Irfan', role: 'New owner', unit: '#08-01', detail: 'Ownership document uploaded', when: '2 days ago', av: 'MI', avClass: 'av-r' },
        { id: 'pt3', name: 'Sri Lakshmi', role: 'Domestic worker', unit: '#07-08', detail: 'Added by owner Noor Fadhilah · Pending work permit verification', when: '3 days ago', av: 'SL', avClass: 'av-t' },
      ],
      vehicles: [
        { plate: 'SKA1234B', unit: '#02-14', owner: 'Rajesh Kumar', type: 'Car', logCard: 'Uploaded', status: 'Approved' },
        { plate: 'SLB4567D', unit: '#02-14', owner: 'Rajesh Kumar', type: 'Car', logCard: 'Uploaded', status: 'Approved' },
        { plate: 'SHA7890C', unit: '#04-22', owner: 'Lee Hwee Leng', type: 'Car', logCard: 'Uploaded', status: 'Approved' },
        { plate: 'SBA4411G', unit: '#12-17', owner: 'Arjun Sharma', type: 'Car', logCard: 'Pending review', status: 'Under review' },
      ],
      guests: [
        { id: 'g1', name: 'David Tan Wei Ming', unit: '#07-08', phone: '+65 9123 4567', plate: '', validFrom: '2025-06-24T10:00', validTo: '2025-06-24T23:00', status: 'Active', qrId: 'GX-240624-4821' },
        { id: 'g2', name: 'SJK4521T vehicle pass', unit: '#02-14', phone: '', plate: 'SJK4521T', validFrom: '2025-06-24T08:00', validTo: '2025-06-24T18:00', status: 'Pending ANPR', qrId: 'GX-240624-4822' },
        { id: 'g3', name: 'Priya Rajan', unit: '#12-17', phone: '', plate: '', validFrom: '2025-06-24T10:34', validTo: '2025-06-24T12:52', status: 'Departed', qrId: 'GX-240624-4799' },
      ],
      accessLog: [
        { time: '10:41am', identity: 'David Tan Wei Ming — QR scan', gate: 'Gate A', method: 'QR code', unit: '#07-08', outcome: 'Granted' },
        { time: '10:38am', identity: 'SJK4521T — ANPR scan', gate: 'Car park', method: 'ANPR', unit: '#02-14', outcome: 'Pending' },
        { time: '10:33am', identity: 'Resident access card · #12-05', gate: 'Gate B', method: 'Access card', unit: '#12-05', outcome: 'Granted' },
        { time: '10:29am', identity: 'SKL8812 — unregistered', gate: 'Car park', method: 'ANPR', unit: '—', outcome: 'Denied' },
        { time: '10:22am', identity: 'FIN G1234567A — QR scan', gate: 'Gate A', method: 'QR code', unit: '#03-18', outcome: 'Granted' },
        { time: '10:11am', identity: 'Parcel delivery — walk-in', gate: 'Gate A', method: 'Manual', unit: '#09-22', outcome: 'Granted' },
      ],
      feeRecords: {
        '#02-14': { Jan: 'paid', Feb: 'paid', Mar: 'paid', Apr: 'paid', May: 'paid', Jun: 'paid', Jul: 'unpaid', Aug: 'unpaid', Sep: 'unpaid', Oct: 'unpaid', Nov: 'unpaid', Dec: 'unpaid' },
        '#04-22': { Jan: 'paid', Feb: 'paid', Mar: 'paid', Apr: 'partial', May: 'unpaid', Jun: 'unpaid', Jul: 'unpaid', Aug: 'unpaid', Sep: 'unpaid', Oct: 'unpaid', Nov: 'unpaid', Dec: 'unpaid' },
        '#07-08': { Jan: 'paid', Feb: 'paid', Mar: 'paid', Apr: 'paid', May: 'paid', Jun: 'paid', Jul: 'unpaid', Aug: 'unpaid', Sep: 'unpaid', Oct: 'unpaid', Nov: 'unpaid', Dec: 'unpaid' },
        '#11-03': { Jan: 'paid', Feb: 'paid', Mar: 'partial', Apr: 'overdue', May: 'overdue', Jun: 'overdue', Jul: 'unpaid', Aug: 'unpaid', Sep: 'unpaid', Oct: 'unpaid', Nov: 'unpaid', Dec: 'unpaid' },
        '#12-17': { Jan: 'paid', Feb: 'paid', Mar: 'paid', Apr: 'paid', May: 'paid', Jun: 'paid', Jul: 'unpaid', Aug: 'unpaid', Sep: 'unpaid', Oct: 'unpaid', Nov: 'unpaid', Dec: 'unpaid' },
      },
      payments: [
        { unit: '#02-14', date: '1 Jun', period: 'Jun 2025', amount: 850, method: 'PayNow', ref: 'RG-0214-JUN25' },
        { unit: '#02-14', date: '1 May', period: 'May 2025', amount: 850, method: 'PayNow', ref: 'RG-0214-MAY25' },
        { unit: '#02-14', date: '2 Apr', period: 'Apr 2025', amount: 850, method: 'PayNow', ref: 'RG-0214-APR25' },
      ],
      monthlyCollection: [
        { month: 'January', expected: 231600, collected: 229800 },
        { month: 'February', expected: 231600, collected: 228400 },
        { month: 'March', expected: 231600, collected: 225100 },
        { month: 'April', expected: 231600, collected: 220800 },
        { month: 'May', expected: 231600, collected: 221400 },
        { month: 'June', expected: 231600, collected: 218400 },
      ],
      facilities: [
        { name: 'Tennis Court A–D', category: 'Sports', capacity: '4 per court', rules: '1h slots · 7am–10pm', maxPerUnit: 4, status: 'Active' },
        { name: 'Swimming Pool', category: 'Leisure', capacity: '30 pax', rules: 'Open access', maxPerUnit: 0, status: 'Active' },
        { name: 'Karaoke Room', category: 'Entertainment', capacity: '10 pax', rules: '2h slots · 4pm–12am', maxPerUnit: 2, status: 'Active' },
        { name: 'Function Room A', category: 'Event', capacity: '80 pax', rules: 'Half / full day', maxPerUnit: 2, status: 'Active' },
        { name: 'BBQ Pits (3)', category: 'Outdoor', capacity: '15 per pit', rules: 'Evening slot', maxPerUnit: 2, status: 'Maintenance' },
        { name: 'Games Room', category: 'Leisure', capacity: '15 pax', rules: 'Open access', maxPerUnit: 0, status: 'Active' },
        { name: 'Gymnasium', category: 'Fitness', capacity: '20 pax', rules: 'Open access · 6am–11pm', maxPerUnit: 0, status: 'Active' },
      ],
      bookings: [
        { id: 'b1', date: '2025-06-24', facility: 'Tennis Court A', unit: '#02-14', time: '9am', cls: 'bc-teal' },
        { id: 'b2', date: '2025-06-24', facility: 'Swimming Pool', unit: '#07-08', time: '2pm', cls: 'bc-blue' },
        { id: 'b3', date: '2025-06-25', facility: 'Karaoke Room', unit: '#12-17', time: '7pm', cls: 'bc-purple' },
        { id: 'b4', date: '2025-06-27', facility: 'Tennis Court C', unit: '#04-22', time: '8am', cls: 'bc-teal' },
        { id: 'b5', date: '2025-06-27', facility: 'Function Room A', unit: '#11-03', time: '6pm', cls: 'bc-purple' },
        { id: 'b6', date: '2025-06-28', facility: 'Tennis Court A', unit: '#02-14', time: '10:00–11:00am', cls: 'bc-teal' },
        { id: 'b7', date: '2025-06-29', facility: 'Tennis Court B', unit: '#07-08', time: '9am', cls: 'bc-teal' },
        { id: 'b8', date: '2025-06-30', facility: 'Tennis Court D', unit: '#02-14', time: '7am', cls: 'bc-teal' },
      ],
      maintenanceTickets: [
        { id: 'mt1', unit: '#04-22', category: 'Plumbing', desc: 'Kitchen sink leaking under cabinet', priority: 'High', status: 'Open', vendor: '', raised: '2 hours ago', photo: null },
        { id: 'mt2', unit: '#02-14', category: 'Electrical', desc: 'Corridor light flickering outside unit', priority: 'Medium', status: 'In progress', vendor: 'BrightSpark Electrical', raised: '1 day ago', photo: null },
        { id: 'mt3', unit: '#12-17', category: 'Lift', desc: 'Lift B making grinding noise', priority: 'High', status: 'In progress', vendor: 'Otis Lift Maintenance', raised: '2 days ago', photo: null },
        { id: 'mt4', unit: '#07-08', category: 'Pest control', desc: 'Ants near balcony', priority: 'Low', status: 'Resolved', vendor: 'Rentokil', raised: '5 days ago', photo: null },
      ],
      announcements: [
        { id: 'an1', title: 'BBQ Pits — maintenance', body: 'BBQ Pits 1–3 will be closed 25–27 Jun for deck resurfacing. Bookings during this period have been cancelled and refunded.', priority: 'High', audience: 'All', posted: '22 Jun 2025' },
        { id: 'an2', title: 'AGM Notice — 2025', body: 'The Annual General Meeting will be held on 20 Jul 2025, 7:30pm at Function Room A. All owners are encouraged to attend.', priority: 'High', audience: 'All', posted: '15 Jun 2025' },
        { id: 'an3', title: 'Water supply interruption', body: 'Tower B will experience a water supply interruption on 26 Jun, 10pm–6am for pipe maintenance.', priority: 'Medium', audience: 'Tower B', posted: '20 Jun 2025' },
      ],
      documents: [
        { id: 'd1', name: 'MCST By-Laws (2024 Edition)', category: 'By-laws', date: '2024-01-10', size: '420 KB' },
        { id: 'd2', name: 'AGM Minutes — 2024', category: 'AGM minutes', date: '2024-07-22', size: '180 KB' },
        { id: 'd3', name: 'Building Insurance Certificate 2025', category: 'Insurance', date: '2025-01-05', size: '95 KB' },
        { id: 'd4', name: 'Fire Safety Certificate 2025', category: 'Insurance', date: '2025-02-12', size: '88 KB' },
        { id: 'd5', name: 'House Rules — Pets & Renovation', category: 'By-laws', date: '2023-11-01', size: '210 KB' },
      ],
      polls: [
        {
          id: 'p1', title: 'AGM 2025 — Approve repainting budget of $180,000', status: 'Open',
          options: [{ label: 'Approve', votes: 0 }, { label: 'Reject', votes: 0 }, { label: 'Abstain', votes: 0 }],
          voters: {},
        },
        {
          id: 'p2', title: 'Re-elect MC Chairperson — Mdm Tan Siew Hoon', status: 'Closed',
          options: [{ label: 'Yes', votes: 198 }, { label: 'No', votes: 24 }],
          voters: {},
        },
      ],
      parcels: [
        { id: 'pa1', unit: '#02-14', courier: 'Lazada Express', desc: '1 box', received: '24 Jun, 9:15am', status: 'Pending collection' },
        { id: 'pa2', unit: '#07-08', courier: 'Ninja Van', desc: '2 parcels', received: '23 Jun, 4:40pm', status: 'Collected' },
        { id: 'pa3', unit: '#12-17', courier: 'SingPost', desc: 'Registered mail', received: '24 Jun, 11:02am', status: 'Pending collection' },
      ],
      vendors: [
        { id: 'v1', name: 'Otis Lift Maintenance', category: 'Lift maintenance', contact: '+65 6555 1234', contractExpiry: '2025-09-30' },
        { id: 'v2', name: 'BrightSpark Electrical', category: 'Electrical', contact: '+65 6555 9876', contractExpiry: '2026-02-15' },
        { id: 'v3', name: 'CleanCo Pte Ltd', category: 'Cleaning', contact: '+65 6555 4567', contractExpiry: '2025-07-20' },
        { id: 'v4', name: 'GreenScape Landscaping', category: 'Landscaping', contact: '+65 6555 7788', contractExpiry: '2025-12-01' },
        { id: 'v5', name: 'SecureGuard Services', category: 'Security', contact: '+65 6555 3322', contractExpiry: '2025-08-05' },
      ],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* corrupt, fall through to reseed */ }
    const s = seed();
    save(s);
    return s;
  }

  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  let state = load();
  const listeners = [];

  const Store = {
    get() { return state; },
    set(mutatorFn) {
      mutatorFn(state);
      save(state);
      listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
    },
    subscribe(fn) { listeners.push(fn); },
    resetDemoData() {
      state = seed();
      save(state);
      localStorage.removeItem(CUR_USER_KEY);
      listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
    },
    uid(prefix) {
      return prefix + '_' + Math.random().toString(36).slice(2, 9);
    },
    currentUser() {
      return localStorage.getItem(CUR_USER_KEY) || 'resident_02-14';
    },
  };

  global.MX = Store;
})(window);
