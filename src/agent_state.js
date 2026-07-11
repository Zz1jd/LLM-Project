function issueCount(evaluation) {
    return evaluation ? evaluation.errorCount : Number.MAX_SAFE_INTEGER;
}

function createAgentState({ task, model, mode, maxIterations }) {
    return {
        task,
        model,
        mode,
        maxIterations,
        status: 'running',
        terminationReason: null,
        observations: [],
        decisions: [],
        bestArtifact: null,
        bestErrorCount: Number.MAX_SAFE_INTEGER,
        noImprovementStreak: 0
    };
}

function recordObservation(agentState, {
    phase,
    iteration = 0,
    evaluation,
    artifact,
    screenshots = []
}) {
    const currentErrors = issueCount(evaluation);
    const previous = agentState.observations[agentState.observations.length - 1];

    if (previous && phase === 'repair') {
        agentState.noImprovementStreak = currentErrors < previous.totalErrors
            ? 0
            : agentState.noImprovementStreak + 1;
    }

    if (currentErrors < agentState.bestErrorCount) {
        agentState.bestErrorCount = currentErrors;
        agentState.bestArtifact = artifact;
    }

    const observation = {
        phase,
        iteration,
        totalErrors: currentErrors,
        a11yErrors: evaluation ? evaluation.a11yCount : null,
        securityErrors: evaluation ? evaluation.secCount : null,
        artifact,
        screenshotCount: screenshots.length
    };
    agentState.observations.push(observation);
    return observation;
}

function decideNextAction(agentState, {
    nextIteration,
    maxIterations,
    visionReviewPending = false
}) {
    const latest = agentState.observations[agentState.observations.length - 1];
    if (!latest) {
        throw new Error('Agent decision requested before any observation was recorded');
    }

    let decision;
    if (latest.totalErrors === 0 && !visionReviewPending) {
        decision = {
            action: 'terminate',
            reason: 'resolved',
            message: 'All automated accessibility and security checks passed.'
        };
    } else if (nextIteration > maxIterations) {
        decision = {
            action: 'terminate',
            reason: 'max_iterations',
            message: 'The configured repair budget was exhausted.'
        };
    } else if (agentState.noImprovementStreak >= 2) {
        decision = {
            action: 'terminate',
            reason: 'plateau',
            message: 'Two consecutive repair attempts failed to reduce the issue count.'
        };
    } else {
        decision = {
            action: 'repair',
            reason: visionReviewPending ? 'vision_review' : 'remaining_findings',
            message: visionReviewPending
                ? 'Run one screenshot-informed review before terminating the multimodal branch.'
                : 'Outstanding evaluation findings remain.'
        };
    }

    const enriched = {
        ...decision,
        iteration: nextIteration,
        currentErrors: latest.totalErrors,
        noImprovementStreak: agentState.noImprovementStreak
    };
    agentState.decisions.push(enriched);

    if (enriched.action === 'terminate') {
        agentState.status = enriched.reason === 'resolved' ? 'solved' : enriched.reason;
        agentState.terminationReason = enriched.reason;
    }

    return enriched;
}

module.exports = {
    createAgentState,
    recordObservation,
    decideNextAction
};
