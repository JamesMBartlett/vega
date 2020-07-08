import {transforms} from 'vega-dataflow';
import {functionContext} from 'vega-functions';
import {context} from 'vega-runtime';

export default function(view, spec, expr, registerOpsCb, copyFromCtx) {
  const ctx = context(view, transforms, functionContext, expr, registerOpsCb);
  if (copyFromCtx) {
    ctx.copyFrom(copyFromCtx);
  }
  return ctx.parse(spec);
}
