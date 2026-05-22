export interface HeaderProps {
  onLogin?: () => void;
  onLogout?: () => void;
  onCreateAccount?: () => void;
  play: (isPlay: boolean) => void;
  visibleForrester: (isVisible: boolean) => void;
  baseModel: () => void;
  user?: {
    name: string;
  };
}
