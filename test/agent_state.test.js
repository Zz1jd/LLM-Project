const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createAgentState,
    recordObservation,
    decideNextAction
} = require('../src/agent_state');

function evaluation(errorCount) {
    return {
        errorCount,
        a11yCount: errorCount,
        secCount: 0
    };
}

test('terminates immediately when automated findings are resolved', () => {
    const state = createAgentState({
        task: 'task1_login',
        model: 'gpt-4o',
        mode: 'text-only',
        maxIterations: 3
    });
    recordObservation(state, {
        phase: 'initial',
        evaluation: evaluation(0),
        artifact: 'artifact.html'
    });

    const decision = decideNextAction(state, {
        nextIteration: 1,
        maxIterations: 3
    });

    assert.equal(decision.action, 'terminate');
    assert.equal(decision.reason, 'resolved');
    assert.equal(state.status, 'solved');
});

test('allows one screenshot review for the multimodal branch', () => {
    const state = createAgentState({
        task: 'task15_cookie_banner',
        model: 'gpt-4o',
        mode: 'multimodal',
        maxIterations: 3
    });
    recordObservation(state, {
        phase: 'initial',
        evaluation: evaluation(0),
        artifact: 'artifact.html',
        screenshots: ['desktop.png']
    });

    const decision = decideNextAction(state, {
        nextIteration: 1,
        maxIterations: 3,
        visionReviewPending: true
    });

    assert.equal(decision.action, 'repair');
    assert.equal(decision.reason, 'vision_review');
});

test('stops when two consecutive repairs do not improve the issue count', () => {
    const state = createAgentState({
        task: 'task30_video_player_controls',
        model: 'gpt-4o',
        mode: 'text-only',
        maxIterations: 3
    });
    recordObservation(state, {
        phase: 'initial',
        evaluation: evaluation(4),
        artifact: 'initial.html'
    });
    recordObservation(state, {
        phase: 'repair',
        iteration: 1,
        evaluation: evaluation(4),
        artifact: 'iteration-1.html'
    });
    recordObservation(state, {
        phase: 'repair',
        iteration: 2,
        evaluation: evaluation(5),
        artifact: 'iteration-2.html'
    });

    const decision = decideNextAction(state, {
        nextIteration: 3,
        maxIterations: 3
    });

    assert.equal(decision.action, 'terminate');
    assert.equal(decision.reason, 'plateau');
    assert.equal(state.status, 'plateau');
});
