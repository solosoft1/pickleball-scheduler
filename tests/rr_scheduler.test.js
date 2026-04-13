const { scheduleDoublesRoundRobin } = require('../rr_scheduler');

describe('scheduleDoublesRoundRobin', () => {
    test('export exists and is a function', () => {
        expect(typeof scheduleDoublesRoundRobin).toBe('function');
    });

    const  courts = ['court_2', 'court_3','court_5','court_6']; // 4 courts 

    test('8 players with 2 courts produces 2 matches of 4 players each', () => {
        const players = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H','I','J','K','L', 'M','N','O','P']; 
        const rounds = 8;

        const schedule = scheduleDoublesRoundRobin(players, courts, rounds);
        // console.log(JSON.stringify(schedule, null, 2));
        expect(Array.isArray(schedule)).toBe(true);
        expect(schedule.length).toBe(rounds);
        const round = schedule[0];
        expect(Array.isArray(round.matches)).toBe(true);
        expect(round.matches.length).toBe(players.length/courts.length);  
        const match = round.matches[0];
        expect(match.teams.length).toBe(2);
        expect(match.teams[0].length).toBe(2);
        expect(match.teams[1].length).toBe(2);

        const allPlayers = round.matches.flatMap(m => m.teams.flat());
        // there should be 8 unique players used in matches
        const unique = new Set(allPlayers);
        expect(unique.size).toBe(players.length);   
    });

    test('numeric player count builds labeled players and schedules 1 match for 4 players', () => {
        const schedule = scheduleDoublesRoundRobin(4, courts,1);
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
        const schedule = scheduleDoublesRoundRobin(players, courts,1);
        const round = schedule[0];
        // with 5 players and one match (4 players), 1 should sit out
        expect(Array.isArray(round.sitOut)).toBe(true);
        expect(round.sitOut.length).toBe(1);
    });
});
