const BASE_ICEBREAKERS = [
  "If you had to survive a zombie apocalypse with only the objects in your room right now, how screwed are you?",
  "Would you rather always have slightly wet socks or have your phone screen permanently at 5% battery?",
  "What's the absolute go-to midnight snack for you?",
  "If you could delete one social media platform forever, which one and why?",
  "What is a controversial food opinion you would defend with your life?",
  "What's the last rabbit hole you went down on YouTube or TikTok?",
  "If you could teleport to any place in the world right now, where would you go?",
  "What's a weird habit you had as a kid that you still do?"
];

const INTEREST_MAP = {
  gaming: [
    "What's your all-time favorite game, and what is the last game that actually disappointed you?",
    "If you could live inside any video game world for a week, which one are you picking?",
    "Who is your absolute go-to character in Mario Kart or Smash Bros?"
  ],
  anime: [
    "If you could have any anime power or ability, which one are you stealing?",
    "What anime made you cry the most, and which one made you laugh the loudest?",
    "Give me your top 3 anime list. No explanations, just list them."
  ],
  coding: [
    "Tabs or spaces? Choose wisely, our friendship depends on it.",
    "What was the first programming language you learned, and do you actually like it?",
    "What is your dream software project that you will probably never finish?"
  ],
  music: [
    "Tell me a song that is an absolute 10/10 for you right now.",
    "If you could only listen to one artist for the rest of the year, who is it?",
    "What is your ultimate guilty pleasure song that you only sing in the shower?"
  ],
  football: [
    "Who is the greatest of all time in your opinion, and why is it Messi/Ronaldo?",
    "What's the most intense football match you've ever watched?",
    "If you could play for any football club in the world for one match, which one?"
  ]
};

const MOOD_MAP = {
  bored: [
    "Quick! What's the most random fact you know to cure our mutual boredom?",
    "Let's play a game: pick a number 1 to 10. If we match, we must immediately share our worst selfie."
  ],
  excited: [
    "What is the best thing that happened to you this week? Let's hype it up!",
    "What's something you're currently looking forward to? I want the details!"
  ],
  lonely: [
    "What is a cozy comfort movie or show that always makes you feel less alone?",
    "Tell me about a time you met a stranger and had an surprisingly deep connection."
  ],
  stressed: [
    "What is your ultimate way to decompress when everything gets a bit too chaotic?",
    "Let's vent. What's the most annoying thing you had to deal with today?"
  ],
  chill: [
    "What's your perfect definition of a lazy Sunday afternoon?",
    "If you could have a peaceful cabin in the woods or a sleek penthouse in Tokyo, which one?"
  ]
};

function generateIcebreaker(interests = [], mood = 'chill') {
  // Try matching shared interests first
  const matchedInterests = interests.filter(i => INTEREST_MAP[i.toLowerCase()]);
  if (matchedInterests.length > 0) {
    const selectedInterest = matchedInterests[Math.floor(Math.random() * matchedInterests.length)];
    const list = INTEREST_MAP[selectedInterest.toLowerCase()];
    return list[Math.floor(Math.random() * list.length)];
  }

  // Try mood matching
  if (MOOD_MAP[mood.toLowerCase()]) {
    const list = MOOD_MAP[mood.toLowerCase()];
    // 50% chance to use mood-based icebreaker
    if (Math.random() > 0.5) {
      return list[Math.floor(Math.random() * list.length)];
    }
  }

  // Default fallback list
  return BASE_ICEBREAKERS[Math.floor(Math.random() * BASE_ICEBREAKERS.length)];
}

export { generateIcebreaker };
