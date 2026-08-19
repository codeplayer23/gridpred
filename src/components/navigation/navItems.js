import { Home, Users, Shield, Flag, Sparkles, LineChart } from 'lucide-react';

export const navItems = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/drivers', label: 'Drivers', icon: Users },
  { to: '/teams', label: 'Teams', icon: Shield },
  { to: '/races', label: 'Races', icon: Flag },
  { to: '/predict', label: 'Predict', icon: Sparkles },
  { to: '/analytics', label: 'Analytics', icon: LineChart },
];
