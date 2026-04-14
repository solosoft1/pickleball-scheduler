/**
 * rr_scheduler.js
 *
 * Generate a round-robin style doubles schedule for pickleball.
 *
 * Usage:
 *   const { scheduleDoublesRoundRobin } = require('./rr_scheduler');
 *   const players = ['A','B','C','D','E','F','G','H'];
 *   const courts = ['court_1','court_3',court_5'];
 *   const schedule = scheduleDoublesRoundRobin(players, 2, 5);
 *
 * Returns an array of rounds. Each round is an object with `matches` and `sitOut`.
 */

function key(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function makePlayers(p) {
    if (Array.isArray(p)) return p.slice();
    const n = Number(p) || 0;
    const arr = [];
    for (let i = 1; i <= n; i++) arr.push(`P${i}`);
    return arr;
}

function shuffle(array) {
    // Fisher-Yates shuffle
    let currentIndex = array.length;
    while (currentIndex !== 0) {
        // Pick a remaining element
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element
        let temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    return array;
}

const solver = require("javascript-lp-solver");

function solveTennis(xPlayers, rounds) {
    const numCourts = Math.floor(xPlayers / 4);
    const model = {
        optimize: "spread",
        opType: "min",
        constraints: {},
        variables: {},
        ints: {},
        binaries: {}
    };

    // Helper to generate variable names
    const getVar = (p, r, c, s) => `play_p${p}_r${r}_c${c}_s${s}`;

    for (let r = 0; r < rounds; r++) {
        // Constraint: Each player plays at most once per round
        for (let p = 0; p < xPlayers; p++) {
            const cName = `player_${p}_round_${r}`;
            model.constraints[cName] = { max: 1 };
            for (let c = 0; c < numCourts; c++) {
                for (let s = 0; s < 2; s++) {
                    const vName = getVar(p, r, c, s);
                    model.variables[vName] = model.variables[vName] || { spread: 0 };
                    model.variables[vName][cName] = 1;
                    model.binaries[vName] = 1;
                }
            }
        }

        // Constraint: Each side of each court has exactly 2 players
        for (let c = 0; c < numCourts; c++) {
            for (let s = 0; s < 2; s++) {
                const cName = `court_${c}_side_${s}_round_${r}`;
                model.constraints[cName] = { equal: 2 };
                for (let p = 0; p < xPlayers; p++) {
                    model.variables[getVar(p, r, c, s)][cName] = 1;
                }
            }
        }
    }

    // Site Balancing Logic
    // We minimize (max_pref - min_pref) by setting objective to 'spread'
    model.variables.max_pref = { spread: 1 };
    model.variables.min_pref = { spread: -1 };

    for (let p = 0; p < xPlayers; p++) {
        const maxC = `max_pref_p${p}`;
        const minC = `min_pref_p${p}`;
        model.constraints[maxC] = { max: 0 }; // total_pref - max_pref <= 0
        model.constraints[minC] = { min: 0 }; // total_pref - min_pref >= 0

        for (let r = 0; r < rounds; r++) {
            for (let c = 0; c < numCourts; c++) {
                const vName = getVar(p, r, c, 0); // Side 0 is preferred
                model.variables[vName][maxC] = 1;
                model.variables[vName][minC] = 1;
            }
        }
        model.variables.max_pref[maxC] = -1;
        model.variables.min_pref[minC] = -1;
    }

    return solver.Solve(model);
}



function scheduleDoublesRoundRobin(playersInput, courts, rounds = 1) {
    const players = makePlayers(playersInput);
    const n = players.length;
    const maxMatchesPerRound = Math.min(courts.length, Math.floor(n / 4));

    const teammateCounts = new Map();
    const opponentCounts = new Map();
    const serveCounts = new Map();
    const preferredSideCounts = new Map();
    const CourtSide = Object.freeze({ SERVE: 'serve', RECEIVE: 'receive' });
    const courtPreferredSide = new Map([
        ['court_1', CourtSide.RECEIVE],
        ['court_2', CourtSide.RECEIVE],
        ['court_3', CourtSide.RECEIVE],
        ['court_4', CourtSide.RECEIVE],
        ['court_5', CourtSide.SERVE],
        ['court_6', CourtSide.SERVE],
        ['court_7', CourtSide.SERVE],
        ['court_8', CourtSide.SERVE],
        ['court_9', CourtSide.SERVE],
    ])

    function tcount(a, b) { return teammateCounts.get(key(a, b)) || 0; }
    function ocount(a, b) { return opponentCounts.get(key(a, b)) || 0; }
    function incTeammate(a, b) { const k = key(a, b); teammateCounts.set(k, (teammateCounts.get(k) || 0) + 1); }
    function incOpponent(a, b) { const k = key(a, b); opponentCounts.set(k, (opponentCounts.get(k) || 0) + 1); }
    function sCount(p) { return serveCounts.get(p) || 0; }
    function incServe(p) { serveCounts.set(p, (serveCounts.get(p) || 0) + 1); }

    const schedule = [];

    for (let r = 0; r < rounds; r++) {
        const availablePlayers = shuffle(players.slice());
        const availableCourts = shuffle(courts.slice());
        const matches = [];
        let courtNo = 1;

        while (matches.length < maxMatchesPerRound && availablePlayers.length >= 4) {
            const A = availablePlayers.shift();

            // choose partner B minimizing prior teammate count
            let bestBIdx = 0;
            let bestBScore = Infinity;
            let bestOScore = Infinity;
            const tieCandidates = [];
            for (let i = 0; i < availablePlayers.length; i++) {
                const cand = availablePlayers[i];
                const score = tcount(A, cand);
                //If multiple candidates have same score, select candidate with minimal opponent interactions with remaining players. 

                if (score < bestBScore) {
                    bestBScore = score;
                    bestBIdx = i;
                    bestOScore = ocount(cand, i);
                    tieCandidates.length = 0;
                }
                else if (score === bestBScore) {
                    const oScore = ocount(cand, i);
                    if (oScore < bestOScore) {
                        bestBIdx = i;
                        bestOScore = oScore;
                    }
                }
            }
            const B = availablePlayers.splice(bestBIdx, 1)[0];

            // choose opponent pair C,D minimizing opponent interactions and repeated teaming
            let bestPair = null;
            let bestPairScore = Infinity;
            for (let i = 0; i < availablePlayers.length; i++) {
                for (let j = i + 1; j < availablePlayers.length; j++) {
                    const C = availablePlayers[i], D = availablePlayers[j];
                    const oppScore = ocount(A, C) + ocount(A, D) + ocount(B, C) + ocount(B, D) + 2 * tcount(C, D);
                    if (oppScore < bestPairScore) { bestPairScore = oppScore; bestPair = { i, j, C, D }; }
                }
            }

            if (!bestPair) { availablePlayers.unshift(B); availablePlayers.unshift(A); break; }

            const { i, j, C, D } = bestPair;
            // remove higher index first
            availablePlayers.splice(j, 1);
            availablePlayers.splice(i, 1);


            // decide preferred side
            const court = courts[courtNo - 1];
            const prefSide = courtPreferredSide.get(court);
            const team1PrefSum = (preferredSideCounts.get(A) || 0) + (preferredSideCounts.get(B) || 0);
            const team2PrefSum = (preferredSideCounts.get(C) || 0) + (preferredSideCounts.get(D) || 0);
            let givePrefToTeam1 = team1PrefSum < team2PrefSum ? true : team1PrefSum > team2PrefSum ? false : null;
            //if preferred side counts are equal, give serve side to team with lowest serve count. 
            if (givePrefToTeam1 === null) givePrefToTeam1 = sCount(A) + sCount(B) <= sCount(C) + sCount(D);
            const team1Side = givePrefToTeam1 ? prefSide : (prefSide === CourtSide.SERVE ? CourtSide.RECEIVE : CourtSide.SERVE);
            const team2Side = givePrefToTeam1 ? (prefSide === CourtSide.SERVE ? CourtSide.RECEIVE : CourtSide.SERVE) : prefSide;


            if (prefSide === CourtSide.SERVE) {
                incServe(A); incServe(B);
            }
            else {
                incServe(C); incServe(D);
            }


            if (givePrefToTeam1) {
                preferredSideCounts.set(A, (preferredSideCounts.get(A) || 0) + 1);
                preferredSideCounts.set(B, (preferredSideCounts.get(B) || 0) + 1);
            }
            else {
                preferredSideCounts.set(C, (preferredSideCounts.get(C) || 0) + 1); preferredSideCounts.set(D, (preferredSideCounts.get(D) || 0) + 1);
            }

            matches.push({ court: court, teams: [[A, B], [C, D]], sides: { team1: team1Side, team2: team2Side } });
            courtNo++;
            incTeammate(A, B); incTeammate(C, D);
            incOpponent(A, C); incOpponent(A, D); incOpponent(B, C); incOpponent(B, D);
        }

        schedule.push({ round: r + 1, matches, sitOut: availablePlayers.slice() });
        // console.log('Teammate counts:', Array.from(teammateCounts.entries()));
    }
    console.log('Teammate counts:', Array.from(teammateCounts.entries()));
    console.log('Opponent counts:', Array.from(opponentCounts.entries()));
    console.log('Serve counts:', Object.fromEntries(serveCounts));
    console.log('Preferred side counts:', Object.fromEntries(preferredSideCounts));
    return schedule;
}

module.exports = { scheduleDoublesRoundRobin, solveTennis};
