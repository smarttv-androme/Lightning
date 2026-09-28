/**
 * Runs low-priority tasks while the stage is idle, keeping them off the frames
 * that render active animation or scrolling.
 *
 * Tasks are ideally run when there budget left within the frame, but they can
 * also be executed when they either:
 * - have been withheld for too long
 * - the task queue has exceeded its configured limit
 */

/** @import {default as Stage} from "./Stage.mjs" */

/**
 * @typedef {Object} QueuedTask
 * @property {Stage.IdleTask} task The task itself
 * @property {number} timestamp When the task was queued
 */

export default class IdleTaskScheduler {

    /**
     * @param {Stage} stage
     */
    constructor(stage) {
        /** @type {Stage} */
        this.stage = stage;
        /** @type {QueuedTask[]} */
        this._queue = [];
        /** @type {number} */
        this.idleSchedulerMinimumBudgetMs = stage.getOption('idleSchedulerMinimumBudgetMs');
        /** @type {number} */
        this.idleSchedulerBusyFrameMaxBudgetMs = stage.getOption('idleSchedulerBusyFrameMaxBudgetMs');
        /** @type {number} */
        this.idleSchedulerIdleFrameMaxBudgetMs = stage.getOption('idleSchedulerIdleFrameMaxBudgetMs');
        /** @type {number} */
        this.idleSchedulerMaxWaitMs = stage.getOption('idleSchedulerMaxWaitMs');
        /** @type {number} */
        this.idleSchedulerMaxQueued = stage.getOption('idleSchedulerMaxQueued');
    }

    destroy() {
        this._queue = [];
        this.stage = null;

        delete this._queue;
        delete this.stage;
    }

    /**
     * @param {boolean} hasRenderUpdates Whether render updates were produced this frame
     */
    processSome(hasRenderUpdates) {
        while (this._shouldProcessTask(hasRenderUpdates)) {
            const entry = this._queue.shift();
            entry.task();
        }
    }

    /**
     * @param {IdleTask} task
     */
    add(task) {
        this._queue.push({
            task: task,
            timestamp: Date.now(),
        });
    }

    /**
     * @param {IdleTask} task
     */
    remove(task) {
        const index = this._queue.findIndex((entry) => entry.task === task);
        if (index >= 0) {
            this._queue.splice(index, 1);
        }
    }

    /**
     * @param {boolean} hasRenderUpdates Whether render updates were produced this frame
     * @return boolean
     * @private
     */
    _shouldProcessTask(hasRenderUpdates) {
        if (this._queue.length === 0) return false;

        // Queue is full, process until we reach the maximum capacity
        if (this._queue.length > this.idleSchedulerMaxQueued) {
            return true;
        }
        // If the oldest task has hit the max wait time, process it
        if (this._isOldestTaskOverdue()) {
            return true;
        }

        // Otherwise, we need to check whether we still have budget left this frame
        const platform = this.stage.platform;
        const frameStart = this.stage.currentTime;
        const now = platform.getHrTime()
        const elapsedMsSinceFrameStart = now - frameStart;

        // If we did not produce render updates this frame, check the idle frame budget
        const idleBudgetMs = this.idleSchedulerIdleFrameMaxBudgetMs - elapsedMsSinceFrameStart;
        const hasIdleFrameBudget = idleBudgetMs > this.idleSchedulerMinimumBudgetMs;
        if (!hasRenderUpdates && hasIdleFrameBudget) {
            return true;
        }

        // Otherwise, check the busy frame budget
        const busyBudgetMs = this.idleSchedulerBusyFrameMaxBudgetMs - elapsedMsSinceFrameStart;
        return busyBudgetMs > this.idleSchedulerMinimumBudgetMs;
    }

    /**
     * @return boolean
     * @private
     */
    _isOldestTaskOverdue() {
        if (this._queue.length === 0) return false;
        return this._isTaskOverdue(this._queue[0]);
    }

    /**
     * @param {QueuedTask | undefined} task
     * @returns boolean
     * @private
     */
    _isTaskOverdue(task) {
        if (!task) return false;

        const now = Date.now();
        const expiration = task.timestamp + this.idleSchedulerMaxWaitMs;
        return now > expiration;
    }
}
