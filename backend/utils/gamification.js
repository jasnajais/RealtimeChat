function getUtcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function updateDailyStreak(user) {
  if (!user) return null;

  const today = getUtcDayKey();
  const yesterday = getUtcDayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const lastDate = user.streakLastDate || null;

  let streak = user.streak || 1;
  if (!lastDate) {
    streak = Math.max(streak, 1);
  } else if (lastDate === today) {
    streak = Math.max(streak, 1);
  } else if (lastDate === yesterday) {
    streak += 1;
  } else {
    streak = 1;
  }

  user.streak = streak;
  user.streakLastDate = today;
  user.lastActive = new Date();

  return {
    streak: user.streak,
    streakLastDate: user.streakLastDate
  };
}

module.exports = { getUtcDayKey, updateDailyStreak };
