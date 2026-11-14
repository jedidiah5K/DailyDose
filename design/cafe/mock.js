// All fake data for the café hub mockups lives here, so it's easy to swap for real data later.
export const MOCK = {
  date: 'Saturday 14 November',
  puzzleNo: 14,
  playersToday: 53340,
  streak: 12,
  freezeAvailable: true,
  suggestedNext: 'rush',
  games: [
    { key: 'shot',   name: 'The Shot',     drink: 'Espresso',   colour: '#FFC93C', ink: '#16120D', result: 'In 4.2 s',   done: true },
    { key: 'blend',  name: 'Blend',        drink: 'Flat white', colour: '#FF8A5B', ink: '#2A1208', result: 'Top 8%',    done: true },
    { key: 'rush',   name: 'Rush',         drink: 'Iced shot',  colour: '#F0452B', ink: '#FFF4EC', result: null,         done: false },
    { key: 'drop',   name: 'Drop',         drink: 'Mocha',      colour: '#1F7A4D', ink: '#FFF4D6', result: null,         done: false },
    { key: 'link',   name: 'Missing Link', drink: 'Cortado',    colour: '#3D5A99', ink: '#F1F4FF', result: null,         done: false },
    { key: 'ladder', name: 'Ladder',       drink: 'Oat latte',  colour: '#E9DFC8', ink: '#2E2A22', result: null,         done: false },
  ],
  // Friends stand at the window. NPC regulars fill in when you have few friends.
  friends: [
    { name: 'Ada',   done: 6, line: 'Dose complete',  beatYou: false, look: 0 },
    { name: 'Tunde', done: 3, line: 'Shot in 3.1 s',  beatYou: true,  look: 1 },
    { name: 'Mira',  done: 2, line: 'Blend top 21%',  beatYou: false, look: 2 },
  ],
  regulars: [{ name: 'Regular', look: 3 }, { name: 'Regular', look: 4 }],
};

// Everyone done, for the "Dose complete" state.
export const MOCK_DONE = {
  ...MOCK,
  games: MOCK.games.map((g, i) => ({ ...g, done: true, result: g.result || ['14 found', 'Banked 320', 'Clue 2', '4 steps'][i - 2] })),
};
