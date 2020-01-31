import { on } from '@ember/object/evented';
import Route from '@ember/routing/route';
import { set, get } from '@ember/object';
import { getActiveStep } from 'screwdriver-ui/utils/build';

const DEFAULT_TIMER = 800;

export default Route.extend({
  routeAfterAuthentication: 'pipeline.build',
  model(params) {
    this.controllerFor('pipeline.build').set('preselectedStepName', params.step_id);

    // return parent route model
    return this.modelFor('pipeline.build');
  },

  afterModel(model) {
    if (!model) {
      return;
    }

    const stepName = this.controllerFor('pipeline.build').get('preselectedStepName');

    if (!model.build.get('steps').findBy('name', stepName)) {
      this.transitionTo('pipeline.build', model.pipeline.get('id'), model.build.get('id'));
    }
  },

  startActiveStep: on('activate', function startTimer() {
    console.log('activate startActiveStep');

    const model = this.modelFor('pipeline.build');
    const timer = setInterval(() => {
      console.log('timer called');

      const name = getActiveStep(get(model, 'build.steps'));

      if (name) {
        this.transitionTo(
          'pipeline.build.step',
          model.pipeline.get('id'),
          model.build.get('id'),
          name
        );
      } else {
        console.log('remove timer');
        clearInterval(this.timer);
      }
    }, DEFAULT_TIMER);

    set(this, 'timer', timer);
  }),

  stopActiveStep: on('deactivate', function clearTimer() {
    console.log('deactivate stopActiveStep');

    clearInterval(this.timer);
  }),

  actions: {
    didTransition() {
      // delegate to its parent route's didTranstion
      return true;
    }
  }
});
