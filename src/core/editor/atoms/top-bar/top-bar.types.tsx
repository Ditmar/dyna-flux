export interface Project {
  id: string;
  name: string;
  isPublic?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
}

export interface HeaderProps {
  play: (isPlay: boolean) => void;
  visibleForrester: (isVisible: boolean) => void;
  baseModel: () => void;
  // project management — visible only when authenticated
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onSave: () => void;
  onNewProject: () => void;
  onLoadProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onShareProject: (id: string) => void;
  projects: Project[];
  isSaving: boolean;
  currentProjectId: string | null;
  currentProjectIsPublic: boolean;
  // auth
  authUser: AuthUser | null;
  onOpenAuth: () => void;
  onLogout: () => void;
}
