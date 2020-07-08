import parseView from './parsers/view';
import parseMultiViewSpec from './parsers/multiview';
import Scope from './Scope';
import defaults from './config';
import {error, isObject, mergeConfig} from 'vega-util';

export default function(spec, config, options) {
  if (!isObject(spec)) {
    error('Input Vega specification must be an object.');
  }

  if (spec.views) {
    return parseMultiViewSpec(spec, config, options);
  }

  config = mergeConfig(defaults(), config, spec.config);
  return parseView(spec, new Scope(config, options)).toRuntime();
}
