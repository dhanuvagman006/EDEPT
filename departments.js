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
    events: ['Mr or Ms Envision', 'Reverse Coding', 'Dumb Charades'],
  },
  {
    key: 'cse',
    name: 'Computer Science Engineering',
    events: ['Singing', 'Operation Cipher Chase', 'BGMI'],
  },
  {
    key: 'csbs',
    name: 'Computer Science and Business Systems',
    events: ['Dance Battle', 'Mad Ad', 'Anime Quiz'],
  },
  {
    key: 'eee',
    name: 'Electrical and Electronics Engineering',
    events: ['Singing', 'Line Follower', 'Free Fire'],
  },
  {
    key: 'ece',
    name: 'Electronics and Communication Engineering',
    events: ['Group Dance', 'Circuit Heist', 'Reels Making'],
  },
  {
    key: 'me',
    name: 'Mechanical Engineering',
    events: ['Cricket', 'Reverse Engineering', 'Treasure Hunt'],
  },
  {
    key: 'marine',
    name: 'Marine Engineering',
    events: ['Mr or Ms Envision', 'Memoria', 'Nautical Rides'],
  },
  {
    key: 'auto',
    name: 'Automobile Engineering',
    events: ['Cricket', 'Slow Bike Racing', 'Feast Fiesta(Eating Challenge)'],
  },
  {
    key: 'aero',
    name: 'Aeronautical Engineering',
    events: ['Cricket', 'Water Rocketry', 'VR Flight Landing'],
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

// Additional events manually marked as mega (e.g. similar names across depts)
const _manualMega = [
  'mr or ms envision',  // CSD_ISE + Marine (same event, same name in data)
  'singing',            // CSE + EEE (stored as "Singing" in response.json)
  'cricket',            // ME + AUTO + AERO
];

const MEGA_EVENTS = new Set([
  ...Object.entries(_eventCount)
    .filter(([, count]) => count >= 2)
    .map(([name]) => name),
  ..._manualMega,
]);

module.exports = { DEPARTMENTS, MEGA_EVENTS };
