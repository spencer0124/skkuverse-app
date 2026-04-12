import { Tab } from '@skkuverse/sds';
import type { Department } from '@skkuverse/shared';

interface Props {
  departments: Department[];
  value: string;
  onChange: (deptId: string) => void;
}

export function DepartmentTabBar({ departments, value, onChange }: Props) {
  return (
    <Tab value={value} onChange={onChange} fluid size="small">
      {departments.map((dept) => (
        <Tab.Item key={dept.id} value={dept.id}>
          {dept.name}
        </Tab.Item>
      ))}
    </Tab>
  );
}
