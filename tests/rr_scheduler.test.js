const { scheduleDoublesRoundRobin } = require('../rr_scheduler');

describe('scheduleDoublesRoundRobin', () => {
    test('export exists and is a function', () => {
        expect(typeof scheduleDoublesRoundRobin).toBe('function');
    });

    test('8 players with 2 courts produces 2 matches of 4 players each', () => {
        const players = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const schedule = scheduleDoublesRoundRobin(players, 2, 1);
        expect(Array.isArray(schedule)).toBe(true);
        expect(schedule.length).toBe(1);
        const round = schedule[0];
        expect(Array.isArray(round.matches)).toBe(true);
        expect(round.matches.length).toBe(2);

        const allPlayers = round.matches.flatMap(m => m.teams.flat());
        // there should be 8 unique players used in matches
        const unique = new Set(allPlayers);
        expect(unique.size).toBe(8);
    });

    test('numeric player count builds labeled players and schedules 1 match for 4 players', () => {
        const schedule = scheduleDoublesRoundRobin(4, 1, 1);
        expect(Array.isArray(schedule)).toBe(true);
        expect(schedule.length).toBe(1);
        const round = schedule[0];
        expect(round.matches.length).toBe(1);
        const match = round.matches[0];
        expect(match.teams.length).toBe(2);
        expect(match.teams[0].length).toBe(2);
        expect(match.teams[1].length).toBe(2);
    });

    test('sitOut lists players when not enough for full rounds', () => {
        const players = ['A', 'B', 'C', 'D', 'E'];
        const schedule = scheduleDoublesRoundRobin(players, 1, 1);
        const round = schedule[0];
        // with 5 players and one match (4 players), 1 should sit out
        expect(Array.isArray(round.sitOut)).toBe(true);
        expect(round.sitOut.length).toBe(1);
    });
});
