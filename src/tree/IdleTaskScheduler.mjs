/**
 * Runs low-priority tasks while the stage is idle, keeping them off the frames
 * that render active animation or scrolling.
 *
 * Tasks are only run after `idleTaskThreshold` frames with no render updates,
 * or when the RAF loop is paused. Idle tasks are allowed to be started as long
 * as they fall within the budget of at most `idleTaskBudgetMs`, but this ca
 * be less depending on the remaining `frameBudgetMs`.
 *
 * Note that tasks can not be cancelled, and can thus go over budget. A task is
 * started as long as there is budget left, but is not guaranteed to stay within
 * the allocated budget.
 */

/**
 * A queued idle task. Mirrors the public {@link Stage.IdleTask} type.
 *
 * @callback IdleTask
 */

export default class IdleTaskScheduler {

    /**
     * @param {import('./Stage.mjs').default} stage
     */
    constructor(stage) {
        this.stage = stage;
        this._tasks = [];
        this._idleFrames = 0;
    }

    destroy() {
        this._tasks = [];
        this.stage = null;

        delete this._tasks;
        delete this.stage;
    }

    /**
     * @param {boolean} hasRenderUpdates Whether this frame produced render updates.
     */
    onFrame(hasRenderUpdates) {
        if (hasRenderUpdates) {
            this._idleFrames = 0;
            return;
        }
        if (++this._idleFrames >= this.stage.getOption('idleTaskThreshold')) {
            this.processSome();
        }
    }

    /**
     * Runs queued tasks within this frame's remaining time budget. Also called
     * directly from the stage's idle-loop frame when the RAF loop is paused.
     */
    processSome() {
        if (this._tasks.length === 0) {
            return;
        }

        const platform = this.stage.platform;
        const frameStart = this.stage.currentTime;
        const idleProcessingStart = platform.getHrTime();
        const elapsed = idleProcessingStart - frameStart;
        const frameBudgetMs = this.stage.getOption('frameBudgetMs');
        const idleTaskBudgetMs = this.stage.getOption('idleTaskBudgetMs');
        const budgetMs = Math.min(frameBudgetMs - elapsed, idleTaskBudgetMs);

        if (budgetMs <= 0) {
            return;
        }

        while (this._tasks.length > 0 && platform.getHrTime() - idleProcessingStart < budgetMs) {
            const task = this._tasks.shift();
            task();
        }
    }

    /**
     * @param {IdleTask} task
     */
    add(task) {
        this._tasks.push(task);
    }

    /**
     * @param {IdleTask} task
     */
    remove(task) {
        const index = this._tasks.indexOf(task);
        if (index >= 0) {
            this._tasks.splice(index, 1);
        }
    }

}
