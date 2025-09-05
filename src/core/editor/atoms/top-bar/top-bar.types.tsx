export interface HeaderProps {
  onLogin?: () => void;
  onLogout?: () => void;
  onCreateAccount?: () => void;
  play: (isPlay: boolean) => void;
  visibleForre: (isVisible: boolean) => void;
  user?: {
    name: string;
  };
}
