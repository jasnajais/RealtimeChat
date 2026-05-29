const ADJECTIVES = [
  'Neon', 'Silent', 'Toxic', 'Magic', 'Cyber', 'Retro', 'Mystic', 'Frozen',
  'Cosmic', 'Galactic', 'Lunar', 'Solar', 'Shiny', 'Sleepy', 'Hyper', 'Turbo',
  'Golden', 'Silver', 'Crimson', 'Cobalt', 'Spooky', 'Wicked', 'Hype', 'Savage'
];

const NOUNS = [
  'Signal', 'Pixel', 'Nova', 'Comet', 'Pulse', 'Cipher', 'Vector', 'Orbit',
  'Beacon', 'Echo', 'Quest', 'Spark', 'Glitch', 'Rune', 'Circuit', 'Rider',
  'Ranger', 'Knight', 'Wizard', 'Hacker', 'Goat', 'Viper', 'Pingu', 'Rocket'
];

function generateTempUsername() {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const number = Math.floor(100 + Math.random() * 900);
  return `${adjective}${noun}${number}`;
}

module.exports = { generateTempUsername };
