import Scope from '../Scope';
import parseSignal from './signal';
import parseSignalUpdates from './signal-updates';
import parseData from './data';
import parseView from './view';
import defaults from '../config';
import {mergeConfig} from 'vega-util';

export default function parseMultiViewSpec(spec, config, options) {
  const globalScope = new Scope({}, options);
  // parse global signals and data.
  (spec.signals || []).forEach((signal) => parseSignal(signal, globalScope));
  (spec.signals || []).forEach((signal) => parseSignalUpdates(signal, globalScope, true)); 
  (spec.data || []).forEach((datum) => parseData(datum, globalScope));


  const viewRuntimes = {};
  Object.getOwnPropertyNames(spec.views || {}).forEach((viewName) => {
    const viewSpec = spec.views[viewName];
    const scope = globalScope.fork();
    scope.config = mergeConfig(defaults(), config, viewSpec.config);
    (viewSpec.globalSignalUpdates || []).forEach((signal) => parseSignalUpdates(signal, scope));
    viewRuntimes[viewName] = parseView(viewSpec, scope).toRuntime();
  });

  return {
    global: globalScope.toRuntime(),
    multi: true,
    children: viewRuntimes,
  };
}