(function initFingendaPerformanceGuard() {
    'use strict';

    if (window.FingendaPerformanceGuard) return;

    const root = document.documentElement;
    const state = {
        mode: root.classList.contains('perf2') ? 'perf2' : (root.classList.contains('perf') ? 'perf' : 'standard'),
        reasons: [],
        longTasks: 0,
        severeLongTasks: 0,
        lastLongTaskAt: 0,
        frameHandle: 0,
        frameTasks: new Map(),
        observer: null
    };

    function addReason(reason) {
        if (!reason || state.reasons.includes(reason)) return;
        state.reasons.push(reason);
        root.dataset.perfReason = state.reasons.slice(-4).join(',');
    }

    function emitModeChange(reason) {
        const detail = {
            mode: state.mode,
            reason,
            reasons: state.reasons.slice()
        };

        if (window.FingendaCore?.events?.emit) {
            window.FingendaCore.events.emit('performance-mode', detail);
            return;
        }

        window.dispatchEvent(new CustomEvent('fingenda:performance-mode', { detail }));
    }

    function enablePerfMode(reason, level = 'perf') {
        addReason(reason);
        root.classList.add('perf');

        if (level === 'perf2') {
            root.classList.add('perf2');
        }

        const nextMode = root.classList.contains('perf2') ? 'perf2' : 'perf';
        if (state.mode === nextMode) return;

        state.mode = nextMode;
        emitModeChange(reason);
    }

    function scheduleIdle(task, timeout = 1200) {
        if (typeof task !== 'function') return 0;

        if ('requestIdleCallback' in window) {
            return window.requestIdleCallback(task, { timeout });
        }

        return window.setTimeout(() => {
            task({
                didTimeout: true,
                timeRemaining: () => 0
            });
        }, Math.min(Math.max(timeout, 16), 250));
    }

    function scheduleFrame(key, task) {
        if (typeof task !== 'function') return;

        state.frameTasks.set(String(key || 'default'), task);
        if (state.frameHandle) return;

        state.frameHandle = window.requestAnimationFrame(() => {
            const tasks = Array.from(state.frameTasks.values());
            state.frameTasks.clear();
            state.frameHandle = 0;

            for (const queuedTask of tasks) {
                try {
                    queuedTask();
                } catch (error) {
                    console.warn('[FingendaPerformanceGuard] frame task failed:', error);
                }
            }
        });
    }

    function detectDeviceBudget() {
        const memory = Number(navigator.deviceMemory || 0);
        const cores = Number(navigator.hardwareConcurrency || 0);
        const reduceMotion = Boolean(
            window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        );

        if (reduceMotion) {
            enablePerfMode('reduced-motion', 'perf');
        }

        if ((memory > 0 && memory <= 3) || (cores > 0 && cores <= 4)) {
            enablePerfMode('low-device-budget', 'perf');
        }
    }

    function observeLongTasks() {
        if (!('PerformanceObserver' in window)) return;

        try {
            state.observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    state.longTasks += 1;
                    state.lastLongTaskAt = Date.now();
                    if (entry.duration >= 120) {
                        state.severeLongTasks += 1;
                    }
                }

                if (state.severeLongTasks >= 2) {
                    enablePerfMode('severe-long-task', 'perf2');
                } else if (state.longTasks >= 4) {
                    enablePerfMode('repeated-long-task', 'perf');
                }
            });
            state.observer.observe({ entryTypes: ['longtask'] });
        } catch (error) {
            state.observer = null;
        }
    }

    function bindLifecycle() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') return;
            state.longTasks = 0;
            state.severeLongTasks = 0;
        }, { passive: true });

        scheduleIdle(() => {
            window.dispatchEvent(new CustomEvent('fingenda:performance-ready', {
                detail: getStats()
            }));
        }, 900);
    }

    function getStats() {
        return {
            mode: state.mode,
            reasons: state.reasons.slice(),
            longTasks: state.longTasks,
            severeLongTasks: state.severeLongTasks,
            lastLongTaskAt: state.lastLongTaskAt
        };
    }

    window.FingendaPerformanceGuard = Object.freeze({
        enablePerfMode,
        scheduleIdle,
        scheduleFrame,
        getStats
    });

    detectDeviceBudget();
    observeLongTasks();
    bindLifecycle();
})();
