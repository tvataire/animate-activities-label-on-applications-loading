'use strict';

const { Clutter, GObject, Graphene, Shell, St } = imports.gi;
const { main: Main } = imports.ui;

var LoadingSpinner = GObject.registerClass(
class LoadingSpinnerRAL extends Clutter.Actor {
    _init() {
        super._init();

        this._startingApps = [];
        this._targetApp = null;

        this._activityButton = Main.panel.statusArea['activities'];
        this._activityLabel = this._activityButton.get_children()[0];

        this._spinner = new Spinner();

        this._stateChangeId = Shell.AppSystem.get_default()
            .connect('app-state-changed', (_, app) => this._onAppStateChanged(app));

        global.stage.add_child(this);
    }

    destroy() {
        Shell.AppSystem.get_default().disconnect(this._stateChangeId);
        this._stateChangeId = 0;

        this._spinner.destroy();
        this._spinner = null;

        this._activityLabel = null;
        this._activityButton = null;

        this._targetApp = null;
        this._startingApps = [];

        super.destroy();
    }

    _startAnimation() {
        if (this._isLoadingSpinner)
            return;

        this._isLoadingSpinner = true;
        this._activityButton.add_child(this._spinner);
        this._spinner.play();
        this._activityButton.remove_child(this._activityLabel);
    }

    _stopAnimation() {
        if (!this._isLoadingSpinner)
            return;

        this._isLoadingSpinner = false;
        this._activityButton.add_child(this._activityLabel);
        this._activityButton.remove_child(this._spinner);
        this._spinner.stop();
    }

    /**
     * Following code is mostly copy/pasted from panel.AppMenuButton with some
     * modifications to adapt it to the spinner...
     */

    _onAppStateChanged(app) {
        const state = app.state;
        if (state !== Shell.AppState.STARTING)
            this._startingApps = this._startingApps.filter(a => a !== app);
        else if (state === Shell.AppState.STARTING)
            this._startingApps.push(app);

        this._sync();
    }

    _findTargetApp() {
        const workspace = global.workspace_manager.get_active_workspace();
        const focusedApp = Shell.WindowTracker.get_default().focus_app;
        if (focusedApp && focusedApp.is_on_workspace(workspace))
            return focusedApp;

        for (let i = 0; i < this._startingApps.length; i++) {
            if (this._startingApps[i].is_on_workspace(workspace))
                return this._startingApps[i];
        }

        return null;
    }

    _sync() {
        const targetApp = this._findTargetApp();

        if (this._targetApp !== targetApp) {
            this._targetApp = targetApp;
            this._targetApp?.disconnectObject(this);
            this._targetApp?.connectObject('notify::busy',
                this._sync.bind(this), this);
        }

        const animate = this._targetApp !== null &&
            (this._targetApp.get_state() === Shell.AppState.STARTING ||
            this._targetApp.get_busy());

        if (animate)
            this._startAnimation();
        else
            this._stopAnimation();
    }
});

const Spinner = GObject.registerClass(
class SpinnerRAL extends St.BoxLayout {
    _init() {
        super._init({ y_align: Clutter.ActorAlign.CENTER });

        this._d1 = new St.Widget({
            style: '\
                background-color: #e6e6e6;\
                border-radius: 99px;\
                margin-right: 6px;',
            width: 7,
            height: 7,
            opacity: 255,
            pivot_point: new Graphene.Point({ x: 0.5, y: 0.5 }),
        });
        this.add_child(this._d1);

        this._d2 = new St.Widget({
            style: '\
                background-color: #e6e6e6;\
                border-radius: 99px;\
                margin-right: 6px;',
            width: 7,
            height: 7,
            opacity: 255,
            pivot_point: new Graphene.Point({ x: 0.5, y: 0.5 }),
        });
        this.add_child(this._d2);

        this._d3 = new St.Widget({
            style: '\
                background-color: #e6e6e6;\
                border-radius: 99px;',
            width: 7,
            height: 7,
            opacity: 255,
            pivot_point: new Graphene.Point({ x: 0.5, y: 0.5 }),
        });
        this.add_child(this._d3);
    }

    play() {
        this._d1.remove_all_transitions();
        this._d2.remove_all_transitions();
        this._d3.remove_all_transitions();

        // Animate to starting position before looping
        this._d1.ease({
            opacity: 255,
            duration: 300,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
        this._d2.ease({
            opacity: 51,
            duration: 300,
            scale_x: .8,
            scale_y: .8,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });
        this._d3.ease({
            opacity: 51,
            duration: 300,
            scale_x: .8,
            scale_y: .8,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._loop()
        });
    }

    _loop() {
        this._reset();

        this._d1.ease({
            opacity: 51,
            duration: 300,
            scale_x: .8,
            scale_y: .8,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._d1.ease({
                opacity: 255,
                duration: 300,
                delay: 600,
                scale_x: 1,
                scale_y: 1,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => this._loop()
            })
        });
        this._d2.ease({
            opacity: 255,
            duration: 300,
            scale_x: 1,
            scale_y: 1,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            repeatCount: 3,
            autoReverse: true
        });
        this._d3.ease({
            opacity: 255,
            duration: 300,
            delay: 300,
            scale_x: 1,
            scale_y: 1,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            repeatCount: 1,
            autoReverse: true,
        });
    }

    _reset() {
        this._d1.set_opacity(255);
        this._d1.set_scale(1, 1);
        this._d2.set_opacity(51);
        this._d2.set_scale(.8, .8);
        this._d3.set_opacity(51);
        this._d3.set_scale(.8, .8);
    }

    stop() {
        this._d1.remove_all_transitions();
        this._d2.remove_all_transitions();
        this._d3.remove_all_transitions();

        this._d1.ease({
            opacity: 255,
            duration: 300,
            scale_x: 1,
            scale_y: 1,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });
        this._d2.ease({
            opacity: 255,
            duration: 300,
            scale_x: 1,
            scale_y: 1,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });
        this._d3.ease({
            opacity: 255,
            duration: 300,
            scale_x: 1,
            scale_y: 1,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });
    }
});
