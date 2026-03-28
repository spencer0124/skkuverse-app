/**
 * Service tabs — horizontal tab bar switching between bus services.
 *
 * Flutter source: bus_campus_screen.dart (service selector)
 */

import { type BusService } from '@skkuuniverse/shared';
import { Tab } from '@skkuuniverse/sds';

interface ServiceTabsProps {
  services: BusService[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function ServiceTabs({ services, selectedIndex, onSelect }: ServiceTabsProps) {
  if (services.length <= 1) return null;

  const selectedValue = services[selectedIndex]?.serviceId ?? services[0].serviceId;

  return (
    <Tab
      value={selectedValue}
      onChange={(value) => {
        const idx = services.findIndex((s) => s.serviceId === value);
        if (idx >= 0) onSelect(idx);
      }}
      fluid
      size="small"
    >
      {services.map((service) => (
        <Tab.Item key={service.serviceId} value={service.serviceId}>
          {service.label}
        </Tab.Item>
      ))}
    </Tab>
  );
}
