const DEPARTMENTS = [
  {
    key: 'aiml',
    name: 'Artificial Intelligence and Machine Learning',
    events: ['Dance Battle', 'Rahasya', 'Super Minute'],
  },
  {
    key: 'aids',
    name: 'Artificial Intelligence and Data Science',
    events: ['Group Dance', 'Blind Coding', 'Geo-Guesser'],
  },
  {
    key: 'csd_ise',
    name: 'Computer Science and Design & Information Science Engineering',
    events: ['Mr & Ms Envision', 'Reverse Coding', 'Dumb Charades'],
  },
  {
    key: 'cse',
    name: 'Computer Science Engineering',
    events: ['Singing Battle', 'Operation Cipher Chase', 'BGMI'],
  },
  {
    key: 'csbs',
    name: 'Computer Science and Business Systems',
    events: ['Dance Battle', 'Mad Ad', 'Anime Quiz'],
  },
  {
    key: 'eee',
    name: 'Electrical and Electronics Engineering',
    events: ['Singing Battle', 'Line Follower', 'Free Fire'],
  },
  {
    key: 'ece',
    name: 'Electronics and Communication Engineering',
    events: ['Group Dance', 'Circuit Heist', 'Reels Making'],
  },
  {
    key: 'me',
    name: 'Mechanical Engineering',
    events: ['Sports', 'Reverse Engineering', 'Treasure Hunt'],
  },
  {
    key: 'marine',
    name: 'Marine Engineering',
    events: ['Mr & Mrs Envision', 'Memoria', 'Nautical Riders'],
  },
  {
    key: 'auto',
    name: 'Automobile Engineering',
    events: ['Sports', 'Slow Bike Racing', 'Feast Fiesta(Eating Challenge)'],
  },
  {
    key: 'aero',
    name: 'Aeronautical Engineering',
    events: ['Sports', 'Water Rocketry', 'Flight Simulator'],
  },
];

// Events shared by 2+ departments — auto-detected
const _eventCount = {};
for (const dept of DEPARTMENTS) {
  for (const event of dept.events) {
    const key = event.toLowerCase();
    _eventCount[key] = (_eventCount[key] || 0) + 1;
  }
}

// Additional events manually marked as mega (same event, slightly different names across depts)
const _manualMega = [
  'mr & ms envision',   // CSD_ISE
  'mr & mrs envision',  // Marine (same event, different label)
  'singing battle',     // CSE + EEE
  'sports',             // ME + AUTO + AERO
  'dance battle',       // AIML + CSBS
  'group dance',        // AIDS + ECE
];

const MEGA_EVENTS = new Set([
  ...Object.entries(_eventCount)
    .filter(([, count]) => count >= 2)
    .map(([name]) => name),
  ..._manualMega,
]);

module.exports = { DEPARTMENTS, MEGA_EVENTS };
