import { useCountUp } from '../utils/motion';
import { money } from '../utils/format';

// رقم يتحرك عند تغيّر قيمته (للوحات التحكم والتقارير)
export default function CountUp({ value, format = money }) {
  const v = useCountUp(value);
  return <span className="num">{format(Math.round(v * 100) / 100)}</span>;
}
