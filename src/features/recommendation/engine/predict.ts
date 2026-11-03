import rawModel from '../models/looktalk_lgbm.json';
import { FEATURE_COLUMNS } from './features';

type Node = {
  split_feature?: number;
  threshold?: number | string;
  decision_type?: string;
  default_left?: boolean;
  missing_type?: string;
  left_child?: Node;
  right_child?: Node;
  leaf_value?: number;
};
type Tree = {tree_index: number; tree_structure: Node};
type LightGBMModel = {num_class: number; feature_names: string[]; tree_info: Tree[]};
const model = rawModel as LightGBMModel;
function treeValue(node: Node, xs: number[]): number {
  if (node.leaf_value !== undefined) return node.leaf_value;
  if (node.split_feature === undefined || !node.left_child || !node.right_child) throw new Error('Invalid tree node');
  const x = xs[node.split_feature];
  const missing = Number.isNaN(x) || (node.missing_type === 'Zero' && x===0);
  let left: boolean;
  if (missing) left = node.default_left ?? false;
  else if (node.decision_type === '<=') left = x <= Number(node.threshold);
  else if (node.decision_type === '==') left = String(node.threshold).split('||').includes(String(x));
  else throw new Error(`Unsupported LightGBM split: ${node.decision_type}`);
  return treeValue(left ? node.left_child : node.right_child,xs);
}
export function predictModel(features: number[]): number[] {
  if (features.length!==FEATURE_COLUMNS.length) throw new Error('Wrong feature length');
  if (model.num_class!==3 || model.feature_names.join('|')!==FEATURE_COLUMNS.join('|')) throw new Error('Model schema mismatch');
  const totals = [0,0,0];
  for (const tree of model.tree_info) totals[tree.tree_index % 3] += treeValue(tree.tree_structure,features);
  const mx = Math.max(...totals);
  const exps = totals.map(v=>Math.exp(v-mx));
  const denom = exps.reduce((a,b)=>a+b,0);
  if (!(denom>0)) throw new Error('Invalid softmax');
  return exps.map(v=>v/denom);
}
