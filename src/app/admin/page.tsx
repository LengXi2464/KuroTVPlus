/* eslint-disable @typescript-eslint/no-explicit-any, no-console, @typescript-eslint/no-non-null-assertion,react-hooks/exhaustive-deps,@typescript-eslint/no-empty-function */

'use client';

import {
  closestCenter,
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertCircle,
  AlertTriangle,
  BookMarked,
  BookOpen,
  Bot,
  Cat,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Cloud,
  Database,
  ExternalLink,
  FileText,
  FolderOpen,
  Globe,
  Mail,
  Palette,
  Plus,
  Settings,
  Trash2,
  Tv,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import { GripVertical } from 'lucide-react';
import {
  Fragment,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { AdminConfig, AdminConfigResult } from '@/lib/admin.types';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { BookSource } from '@/lib/book.types';
import {
  ALL_FEATURE_PERMISSION_KEYS,
  FEATURE_PERMISSION_OPTIONS,
} from '@/lib/feature-permissions';

import AnimeSubscriptionComponent from '@/components/AnimeSubscriptionComponent';
import CorrectDialog from '@/components/CorrectDialog';
import DataMigration from '@/components/DataMigration';
import PageLayout from '@/components/PageLayout';

// 统一按钮样式系统
const buttonStyles = {
  // 主要操作按钮（蓝色）- 用于配置、设置、确认等
  primary:
    'px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg transition-colors',
  // 成功操作按钮（绿色）- 用于添加、启用、保存等
  success:
    'px-3 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-white rounded-lg transition-colors',
  // 危险操作按钮（红色）- 用于删除、禁用、重置等
  danger:
    'px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-lg transition-colors',
  // 次要操作按钮（灰色）- 用于取消、关闭等
  secondary:
    'px-3 py-1.5 text-sm font-medium bg-gray-600 hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-700 text-white rounded-lg transition-colors',
  // 警告操作按钮（黄色）- 用于批量禁用�?  warning:
    'px-3 py-1.5 text-sm font-medium bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-600 dark:hover:bg-yellow-700 text-white rounded-lg transition-colors',
  // 小尺寸主要按�?  primarySmall:
    'px-2 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-md transition-colors',
  // 小尺寸成功按�?  successSmall:
    'px-2 py-1 text-xs font-medium bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-white rounded-md transition-colors',
  // 小尺寸危险按�?  dangerSmall:
    'px-2 py-1 text-xs font-medium bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-md transition-colors',
  // 小尺寸次要按�?  secondarySmall:
    'px-2 py-1 text-xs font-medium bg-gray-600 hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-700 text-white rounded-md transition-colors',
  // 小尺寸警告按�?  warningSmall:
    'px-2 py-1 text-xs font-medium bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-600 dark:hover:bg-yellow-700 text-white rounded-md transition-colors',
  // 圆角小按钮（用于表格操作�?  roundedPrimary:
    'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 dark:text-blue-200 transition-colors',
  roundedSuccess:
    'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/40 dark:hover:bg-green-900/60 dark:text-green-200 transition-colors',
  roundedDanger:
    'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 dark:text-red-200 transition-colors',
  roundedSecondary:
    'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700/40 dark:hover:bg-gray-700/60 dark:text-gray-200 transition-colors',
  roundedWarning:
    'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/40 dark:hover:bg-yellow-900/60 dark:text-yellow-200 transition-colors',
  roundedPurple:
    'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 dark:text-purple-200 transition-colors',
  // 禁用状�?  disabled:
    'px-3 py-1.5 text-sm font-medium bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white rounded-lg transition-colors',
  disabledSmall:
    'px-2 py-1 text-xs font-medium bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white rounded-md transition-colors',
  // 开关按钮样�?  toggleOn: 'bg-green-600 dark:bg-green-600',
  toggleOff: 'bg-gray-200 dark:bg-gray-700',
  toggleThumb: 'bg-white',
  toggleThumbOn: 'translate-x-6',
  toggleThumbOff: 'translate-x-1',
  // 快速操作按钮样�?  quickAction:
    'px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors',
};

const DEFAULT_GROUP_PERMISSIONS = [...ALL_FEATURE_PERMISSION_KEYS];

// 通用弹窗组件
interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'success' | 'error' | 'warning';
  title: string;
  message?: string;
  timer?: number;
  showConfirm?: boolean;
  onConfirm?: () => void;
}

const AlertModal = ({
  isOpen,
  onClose,
  type,
  title,
  message,
  timer,
  showConfirm = false,
  onConfirm,
}: AlertModalProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      if (timer) {
        setTimeout(() => {
          onClose();
        }, timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [isOpen, timer, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className='w-8 h-8 text-green-500' />;
      case 'error':
        return <AlertCircle className='w-8 h-8 text-red-500' />;
      case 'warning':
        return <AlertTriangle className='w-8 h-8 text-yellow-500' />;
      default:
        return null;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full border ${getBgColor()} transition-all duration-200 ${
          isVisible ? 'scale-100' : 'scale-95'
        }`}
      >
        <div className='p-6 text-center'>
          <div className='flex justify-center mb-4'>{getIcon()}</div>

          <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2'>
            {title}
          </h3>

          {message && (
            <p className='text-gray-600 dark:text-gray-400 mb-4'>{message}</p>
          )}

          {showConfirm ? (
            onConfirm ? (
              // 确认操作：显示取消和确定按钮
              <div className='flex gap-3 justify-center'>
                <button
                  onClick={() => {
                    onClose();
                  }}
                  className={buttonStyles.secondary}
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (onConfirm) onConfirm();
                    // 不要在这里调用onClose，让onConfirm自己决定何时关闭
                  }}
                  className={buttonStyles.danger}
                >
                  确定
                </button>
              </div>
            ) : (
              // 普通提示：只显示确定按�?              <button onClick={onClose} className={buttonStyles.primary}>
                确定
              </button>
            )
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
};

// 弹窗状态管�?const useAlertModal = () => {
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message?: string;
    timer?: number;
    showConfirm?: boolean;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
  });

  const showAlert = (config: Omit<typeof alertModal, 'isOpen'>) => {
    setAlertModal({ ...config, isOpen: true });
  };

  const hideAlert = () => {
    setAlertModal((prev) => ({ ...prev, isOpen: false }));
  };

  return { alertModal, showAlert, hideAlert };
};

// 统一弹窗方法（必须在首次使用前定义）
const showError = (message: string, showAlert?: (config: any) => void) => {
  if (showAlert) {
    showAlert({ type: 'error', title: '错误', message, showConfirm: true });
  } else {
    console.error(message);
  }
};

const showSuccess = (message: string, showAlert?: (config: any) => void) => {
  if (showAlert) {
    showAlert({ type: 'success', title: '成功', message, timer: 2000 });
  } else {
    console.log(message);
  }
};

// 通用加载状态管理系�?interface LoadingState {
  [key: string]: boolean;
}

const useLoadingState = () => {
  const [loadingStates, setLoadingStates] = useState<LoadingState>({});

  const setLoading = (key: string, loading: boolean) => {
    setLoadingStates((prev) => ({ ...prev, [key]: loading }));
  };

  const isLoading = (key: string) => loadingStates[key] || false;

  const withLoading = async (
    key: string,
    operation: () => Promise<any>
  ): Promise<any> => {
    setLoading(key, true);
    try {
      const result = await operation();
      return result;
    } finally {
      setLoading(key, false);
    }
  };

  return { loadingStates, setLoading, isLoading, withLoading };
};

interface StandaloneSourceScript {
  id: string;
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  version: string;
  code: string;
  createdAt: number;
  updatedAt: number;
}

// 新增站点配置类型
interface SiteConfig {
  SiteName: string;
  Announcement: string;
  SearchDownstreamMaxPage: number;
  SiteInterfaceCacheTime: number;
  DoubanProxyType: string;
  DoubanProxy: string;
  DoubanImageProxyType: string;
  DoubanImageProxy: string;
  DisableYellowFilter: boolean;
  FluidSearch: boolean;
  DanmakuSourceType?: 'builtin' | 'custom';
  DanmakuApiBase: string;
  DanmakuApiToken: string;
  DanmakuAutoLoadDefault?: boolean;
  TMDBApiKey?: string;
  TMDBProxy?: string;
  TMDBReverseProxy?: string;
  BannerDataSource?: string;
  RecommendationDataSource?: string;
  PansouApiUrl?: string;
  PansouUsername?: string;
  PansouPassword?: string;
  PansouKeywordBlocklist?: string;
  MagnetProxy?: string;
  MagnetMikanReverseProxy?: string;
  MagnetDmhyReverseProxy?: string;
  MagnetAcgripReverseProxy?: string;
  EnableComments: boolean;
  EnableRegistration?: boolean;
  RequireRegistrationInviteCode?: boolean;
  RegistrationInviteCode?: string;
  RegistrationRequireTurnstile?: boolean;
  LoginRequireTurnstile?: boolean;
  TurnstileSiteKey?: string;
  TurnstileSecretKey?: string;
  DefaultUserTags?: string[];
  EnableOIDCLogin?: boolean;
  EnableOIDCRegistration?: boolean;
  OIDCIssuer?: string;
  OIDCAuthorizationEndpoint?: string;
  OIDCTokenEndpoint?: string;
  OIDCUserInfoEndpoint?: string;
  OIDCClientId?: string;
  OIDCClientSecret?: string;
  OIDCButtonText?: string;
}

// 视频源数据类�?interface DataSource {
  name: string;
  key: string;
  api: string;
  detail?: string;
  disabled?: boolean;
  from: 'config' | 'custom';
  proxyMode?: boolean;
  weight?: number;
}

// 直播源数据类�?interface LiveDataSource {
  name: string;
  key: string;
  url: string;
  ua?: string;
  epg?: string;
  channelNumber?: number;
  disabled?: boolean;
  from: 'config' | 'custom';
  proxyMode?: 'full' | 'm3u8-only' | 'direct'; // 代理模式
}

// 自定义分类数据类�?interface CustomCategory {
  name?: string;
  type: 'movie' | 'tv';
  query: string;
  disabled?: boolean;
  from: 'config' | 'custom';
}

// 可折叠标签组�?interface CollapsibleTabProps {
  title: string;
  icon?: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isParent?: boolean;
}

const CollapsibleTab = ({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
  isParent = false,
}: CollapsibleTabProps) => {
  return (
    <div
      className={`rounded-xl shadow-sm mb-4 overflow-hidden ${
        isParent
          ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 ring-2 ring-yellow-400/50 dark:ring-yellow-600/50'
          : 'bg-white/80 backdrop-blur-md dark:bg-gray-800/50 dark:ring-1 dark:ring-gray-700'
      }`}
    >
      <button
        onClick={onToggle}
        className={`w-full px-6 py-4 flex items-center justify-between transition-colors ${
          isParent
            ? 'bg-yellow-100/50 dark:bg-yellow-900/30 hover:bg-yellow-100/70 dark:hover:bg-yellow-900/40'
            : 'bg-gray-50/70 dark:bg-gray-800/60 hover:bg-gray-100/80 dark:hover:bg-gray-700/60'
        }`}
      >
        <div className='flex items-center gap-3'>
          {icon}
          <h3
            className={`text-lg font-medium ${
              isParent
                ? 'text-yellow-900 dark:text-yellow-200'
                : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            {title}
          </h3>
        </div>
        <div
          className={
            isParent
              ? 'text-yellow-700 dark:text-yellow-400'
              : 'text-gray-500 dark:text-gray-400'
          }
        >
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </button>

      {isExpanded && (
        <div className={isParent ? 'px-0.5 md:px-6 py-4' : 'px-6 py-4'}>
          {children}
        </div>
      )}
    </div>
  );
};

// 用户配置组件
interface UserConfigProps {
  config: AdminConfig | null;
  role: 'owner' | 'admin' | null;
  refreshConfig: () => Promise<void>;
  usersV2: Array<{
    username: string;
    role: 'owner' | 'admin' | 'user';
    banned: boolean;
    tags?: string[];
    oidcSub?: string;
    enabledApis?: string[];
    created_at: number;
  }> | null;
  userPage: number;
  userTotalPages: number;
  userTotal: number;
  fetchUsersV2: (page: number) => Promise<void>;
  userListLoading: boolean;
}

const UserConfig = ({
  config,
  role,
  refreshConfig,
  usersV2,
  userPage,
  userTotalPages,
  userTotal,
  fetchUsersV2,
  userListLoading,
}: UserConfigProps) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [showAddUserGroupForm, setShowAddUserGroupForm] = useState(false);
  const [showEditUserGroupForm, setShowEditUserGroupForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    userGroup: '', // 新增用户组字�?  });
  const [changePasswordUser, setChangePasswordUser] = useState({
    username: '',
    password: '',
  });
  const [newUserGroup, setNewUserGroup] = useState({
    name: '',
    enabledApis: [] as string[],
    permissions: [...DEFAULT_GROUP_PERMISSIONS] as string[],
  });
  const [editingUserGroup, setEditingUserGroup] = useState<{
    name: string;
    enabledApis: string[];
    permissions: string[];
  } | null>(null);
  const [showConfigureApisModal, setShowConfigureApisModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    username: string;
    role: 'user' | 'admin' | 'owner';
    enabledApis?: string[];
    tags?: string[];
  } | null>(null);
  const [selectedApis, setSelectedApis] = useState<string[]>([]);
  const [showConfigureUserGroupModal, setShowConfigureUserGroupModal] =
    useState(false);
  const [selectedUserForGroup, setSelectedUserForGroup] = useState<{
    username: string;
    role: 'user' | 'admin' | 'owner';
    tags?: string[];
  } | null>(null);
  const [selectedUserGroups, setSelectedUserGroups] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showBatchUserGroupModal, setShowBatchUserGroupModal] = useState(false);
  const [selectedUserGroup, setSelectedUserGroup] = useState<string>('');
  const [showDeleteUserGroupModal, setShowDeleteUserGroupModal] =
    useState(false);
  const [deletingUserGroup, setDeletingUserGroup] = useState<{
    name: string;
    affectedUsers: Array<{
      username: string;
      role: 'user' | 'admin' | 'owner';
    }>;
  } | null>(null);
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);

  // 当前登录用户�?  const currentUsername = getAuthInfoFromBrowserCookie()?.username || null;

  // 判断是否有旧版用户数据需要迁�?  const hasOldUserData =
    config?.UserConfig?.Users?.filter((u: any) => u.role !== 'owner').length ??
    0 > 0;

  // 使用新版本用户列表（如果可用且没有旧数据），否则使用配置中的用户列表
  const displayUsers: Array<{
    username: string;
    role: 'owner' | 'admin' | 'user';
    banned?: boolean;
    enabledApis?: string[];
    tags?: string[];
    created_at?: number;
    oidcSub?: string;
  }> = !hasOldUserData && usersV2 ? usersV2 : config?.UserConfig?.Users || [];

  // 使用 useMemo 计算全选状态，避免每次渲染都重新计�?  const selectAllUsers = useMemo(() => {
    const selectableUserCount =
      displayUsers?.filter(
        (user) =>
          role === 'owner' ||
          (role === 'admin' &&
            (user.role === 'user' || user.username === currentUsername))
      ).length || 0;
    return selectedUsers.size === selectableUserCount && selectedUsers.size > 0;
  }, [selectedUsers.size, displayUsers, role, currentUsername]);

  // 获取用户组列�?  const userGroups = config?.UserConfig?.Tags || [];

  // 处理用户组相关操�?  const handleUserGroupAction = async (
    action: 'add' | 'edit' | 'delete',
    groupName: string,
    enabledApis?: string[],
    permissions?: string[]
  ) => {
    return withLoading(`userGroup_${action}_${groupName}`, async () => {
      try {
        const res = await fetch('/api/admin/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'userGroup',
            groupAction: action,
            groupName,
            enabledApis,
            permissions,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `操作失败: ${res.status}`);
        }

        await refreshConfig();

        if (action === 'add') {
          setNewUserGroup({
            name: '',
            enabledApis: [],
            permissions: [...DEFAULT_GROUP_PERMISSIONS],
          });
          setShowAddUserGroupForm(false);
        } else if (action === 'edit') {
          setEditingUserGroup(null);
          setShowEditUserGroupForm(false);
        }

        showSuccess(
          action === 'add'
            ? '用户组添加成�?
            : action === 'edit'
            ? '用户组更新成�?
            : '用户组删除成�?,
          showAlert
        );
      } catch (err) {
        showError(err instanceof Error ? err.message : '操作失败', showAlert);
        throw err;
      }
    });
  };

  const handleAddUserGroup = () => {
    if (!newUserGroup.name.trim()) return;
    handleUserGroupAction(
      'add',
      newUserGroup.name,
      newUserGroup.enabledApis,
      newUserGroup.permissions
    );
  };

  const handleEditUserGroup = () => {
    if (!editingUserGroup?.name.trim()) return;
    handleUserGroupAction(
      'edit',
      editingUserGroup.name,
      editingUserGroup.enabledApis,
      editingUserGroup.permissions
    );
  };

  const handleDeleteUserGroup = (groupName: string) => {
    // 计算会受影响的用户数�?    const affectedUsers =
      config?.UserConfig?.Users?.filter(
        (user) => user.tags && user.tags.includes(groupName)
      ) || [];

    setDeletingUserGroup({
      name: groupName,
      affectedUsers: affectedUsers.map((u) => ({
        username: u.username,
        role: u.role,
      })),
    });
    setShowDeleteUserGroupModal(true);
  };

  const handleConfirmDeleteUserGroup = async () => {
    if (!deletingUserGroup) return;

    try {
      await handleUserGroupAction('delete', deletingUserGroup.name);
      setShowDeleteUserGroupModal(false);
      setDeletingUserGroup(null);
    } catch (err) {
      // 错误处理已在 handleUserGroupAction 中处�?    }
  };

  const handleStartEditUserGroup = (group: {
    name: string;
    enabledApis: string[];
    permissions?: string[];
  }) => {
    setEditingUserGroup({
      ...group,
      permissions: group.permissions || [],
    });
    setShowEditUserGroupForm(true);
    setShowAddUserGroupForm(false);
  };

  // 为用户分配用户组
  const handleAssignUserGroup = async (
    username: string,
    userGroups: string[]
  ) => {
    return withLoading(`assignUserGroup_${username}`, async () => {
      try {
        const res = await fetch('/api/admin/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUsername: username,
            action: 'updateUserGroups',
            userGroups,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `操作失败: ${res.status}`);
        }

        await refreshConfig();
        showSuccess('用户组分配成�?, showAlert);
      } catch (err) {
        showError(err instanceof Error ? err.message : '操作失败', showAlert);
        throw err;
      }
    });
  };

  const handleBanUser = async (uname: string) => {
    await withLoading(`banUser_${uname}`, () => handleUserAction('ban', uname));
  };

  const handleUnbanUser = async (uname: string) => {
    await withLoading(`unbanUser_${uname}`, () =>
      handleUserAction('unban', uname)
    );
  };

  const handleSetAdmin = async (uname: string) => {
    await withLoading(`setAdmin_${uname}`, () =>
      handleUserAction('setAdmin', uname)
    );
  };

  const handleRemoveAdmin = async (uname: string) => {
    await withLoading(`removeAdmin_${uname}`, () =>
      handleUserAction('cancelAdmin', uname)
    );
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password) return;
    await withLoading('addUser', async () => {
      await handleUserAction(
        'add',
        newUser.username,
        newUser.password,
        newUser.userGroup
      );
      setNewUser({ username: '', password: '', userGroup: '' });
      setShowAddUserForm(false);
    });
  };

  const handleChangePassword = async () => {
    if (!changePasswordUser.username || !changePasswordUser.password) return;
    await withLoading(
      `changePassword_${changePasswordUser.username}`,
      async () => {
        await handleUserAction(
          'changePassword',
          changePasswordUser.username,
          changePasswordUser.password
        );
        setChangePasswordUser({ username: '', password: '' });
        setShowChangePasswordForm(false);
      }
    );
  };

  const handleShowChangePasswordForm = (username: string) => {
    setChangePasswordUser({ username, password: '' });
    setShowChangePasswordForm(true);
    setShowAddUserForm(false); // 关闭添加用户表单
  };

  const handleDeleteUser = (username: string) => {
    setDeletingUser(username);
    setShowDeleteUserModal(true);
  };

  const handleConfigureUserApis = (user: {
    username: string;
    role: 'user' | 'admin' | 'owner';
    enabledApis?: string[];
  }) => {
    setSelectedUser(user);
    setSelectedApis(user.enabledApis || []);
    setShowConfigureApisModal(true);
  };

  const handleConfigureUserGroup = (user: {
    username: string;
    role: 'user' | 'admin' | 'owner';
    tags?: string[];
  }) => {
    setSelectedUserForGroup(user);
    setSelectedUserGroups(user.tags || []);
    setShowConfigureUserGroupModal(true);
  };

  const handleSaveUserGroups = async () => {
    if (!selectedUserForGroup) return;

    await withLoading(
      `saveUserGroups_${selectedUserForGroup.username}`,
      async () => {
        try {
          await handleAssignUserGroup(
            selectedUserForGroup.username,
            selectedUserGroups
          );
          setShowConfigureUserGroupModal(false);
          setSelectedUserForGroup(null);
          setSelectedUserGroups([]);
        } catch (err) {
          // 错误处理已在 handleAssignUserGroup 中处�?        }
      }
    );
  };

  // 处理用户选择
  const handleSelectUser = useCallback((username: string, checked: boolean) => {
    setSelectedUsers((prev) => {
      const newSelectedUsers = new Set(prev);
      if (checked) {
        newSelectedUsers.add(username);
      } else {
        newSelectedUsers.delete(username);
      }
      return newSelectedUsers;
    });
  }, []);

  const handleSelectAllUsers = useCallback(
    (checked: boolean) => {
      if (checked) {
        // 只选择自己有权限操作的用户
        const selectableUsernames =
          config?.UserConfig?.Users?.filter(
            (user) =>
              role === 'owner' ||
              (role === 'admin' &&
                (user.role === 'user' || user.username === currentUsername))
          ).map((u) => u.username) || [];
        setSelectedUsers(new Set(selectableUsernames));
      } else {
        setSelectedUsers(new Set());
      }
    },
    [config?.UserConfig?.Users, role, currentUsername]
  );

  // 批量设置用户�?  const handleBatchSetUserGroup = async (userGroup: string) => {
    if (selectedUsers.size === 0) return;

    await withLoading('batchSetUserGroup', async () => {
      try {
        const res = await fetch('/api/admin/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'batchUpdateUserGroups',
            usernames: Array.from(selectedUsers),
            userGroups: userGroup === '' ? [] : [userGroup],
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `操作失败: ${res.status}`);
        }

        const userCount = selectedUsers.size;
        setSelectedUsers(new Set());
        setShowBatchUserGroupModal(false);
        setSelectedUserGroup('');
        showSuccess(
          `已为 ${userCount} 个用户设置用户组: ${userGroup}`,
          showAlert
        );

        // 刷新配置
        await refreshConfig();
      } catch (err) {
        showError('批量设置用户组失�?, showAlert);
        throw err;
      }
    });
  };

  // 提取URL域名的辅助函�?  const extractDomain = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      // 如果URL格式不正确，返回原字符串
      return url;
    }
  };

  const handleSaveUserApis = async () => {
    if (!selectedUser) return;

    await withLoading(`saveUserApis_${selectedUser.username}`, async () => {
      try {
        const res = await fetch('/api/admin/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUsername: selectedUser.username,
            action: 'updateUserApis',
            enabledApis: selectedApis,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `操作失败: ${res.status}`);
        }

        // 成功后刷新配�?        await refreshConfig();
        setShowConfigureApisModal(false);
        setSelectedUser(null);
        setSelectedApis([]);
      } catch (err) {
        showError(err instanceof Error ? err.message : '操作失败', showAlert);
        throw err;
      }
    });
  };

  // 通用请求函数
  const handleUserAction = async (
    action:
      | 'add'
      | 'ban'
      | 'unban'
      | 'setAdmin'
      | 'cancelAdmin'
      | 'changePassword'
      | 'deleteUser',
    targetUsername: string,
    targetPassword?: string,
    userGroup?: string
  ) => {
    try {
      const res = await fetch('/api/admin/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUsername,
          ...(targetPassword ? { targetPassword } : {}),
          ...(userGroup ? { userGroup } : {}),
          action,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `操作失败: ${res.status}`);
      }

      // 成功后刷新配置和用户列表（refreshConfig 已经�?refreshConfigAndUsers�?      await refreshConfig();
    } catch (err) {
      showError(err instanceof Error ? err.message : '操作失败', showAlert);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;

    await withLoading(`deleteUser_${deletingUser}`, async () => {
      try {
        await handleUserAction('deleteUser', deletingUser);
        setShowDeleteUserModal(false);
        setDeletingUser(null);
      } catch (err) {
        // 错误处理已在 handleUserAction 中处�?      }
    });
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载�?..
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 用户统计 */}
      <div>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
          用户统计
        </h4>
        <div className='p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800'>
          <div className='text-2xl font-bold text-green-800 dark:text-green-300'>
            {!hasOldUserData && usersV2 ? userTotal : displayUsers.length}
          </div>
          <div className='text-sm text-green-600 dark:text-green-400'>
            总用户数
          </div>
        </div>

        {/* 数据迁移提示 */}
        {config.UserConfig.Users &&
          config.UserConfig.Users.filter((u) => u.role !== 'owner').length >
            0 && (
            <div className='mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800'>
              <div className='flex items-start justify-between'>
                <div className='flex-1'>
                  <h5 className='text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1'>
                    检测到旧版用户数据
                  </h5>
                  <p className='text-xs text-yellow-600 dark:text-yellow-400'>
                    建议迁移到新的用户存储结构，以获得更好的性能和安全性。迁移后用户密码将使用SHA256加密�?                  </p>
                </div>
                <button
                  onClick={() => {
                    showAlert({
                      type: 'warning',
                      title: '确认迁移用户数据',
                      message:
                        '迁移过程中请勿关闭页面。迁移完成后，所有用户密码将使用SHA256加密存储�?,
                      showConfirm: true,
                      onConfirm: async () => {
                        hideAlert();
                        await withLoading('migrateUsers', async () => {
                          try {
                            const response = await fetch(
                              '/api/admin/migrate-users',
                              {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                              }
                            );

                            if (!response.ok) {
                              const errorData = await response.json();
                              throw new Error(errorData.error || '迁移失败');
                            }

                            showAlert({
                              type: 'success',
                              title: '用户数据迁移成功',
                              message: '所有用户已迁移到新的存储结�?,
                              timer: 2000,
                            });
                            await refreshConfig();
                          } catch (error: any) {
                            console.error('迁移用户数据失败:', error);
                            showAlert({
                              type: 'error',
                              title: '迁移失败',
                              message:
                                error.message || '迁移用户数据时发生错�?,
                            });
                          }
                        });
                      },
                    });
                  }}
                  disabled={isLoading('migrateUsers')}
                  className={`ml-4 ${buttonStyles.warning} ${
                    isLoading('migrateUsers')
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }`}
                >
                  {isLoading('migrateUsers') ? '迁移�?..' : '立即迁移'}
                </button>
              </div>
            </div>
          )}
      </div>

      {/* 用户组管�?*/}
      <div>
        <div className='flex items-center justify-between mb-3'>
          <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
            用户组管�?          </h4>
          <button
            onClick={() => {
              setShowAddUserGroupForm(!showAddUserGroupForm);
              if (showEditUserGroupForm) {
                setShowEditUserGroupForm(false);
                setEditingUserGroup(null);
              }
            }}
            className={
              showAddUserGroupForm
                ? buttonStyles.secondary
                : buttonStyles.primary
            }
          >
            {showAddUserGroupForm ? '取消' : '添加用户�?}
          </button>
        </div>

        {/* 用户组列�?*/}
        <div className='border border-gray-200 dark:border-gray-700 rounded-lg max-h-[20rem] overflow-y-auto overflow-x-auto relative'>
          <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
            <thead className='bg-gray-50 dark:bg-gray-900 sticky top-0 z-10'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                  用户组名�?                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                  可用视频�?                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                  功能权限
                </th>
                <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                  操作
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
              {userGroups.map((group) => (
                <tr
                  key={group.name}
                  className='hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                >
                  <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100'>
                    {group.name}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <div className='flex items-center space-x-2'>
                      <span className='text-sm text-gray-900 dark:text-gray-100'>
                        {group.enabledApis && group.enabledApis.length > 0
                          ? `${group.enabledApis.length} 个源`
                          : '无限�?}
                      </span>
                    </div>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <span className='text-sm text-gray-900 dark:text-gray-100'>
                      {group.permissions && group.permissions.length > 0
                        ? `${group.permissions.length} 项`
                        : '�?}
                    </span>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
                    <button
                      onClick={() => handleStartEditUserGroup(group)}
                      disabled={isLoading(`userGroup_edit_${group.name}`)}
                      className={`${buttonStyles.roundedPrimary} ${
                        isLoading(`userGroup_edit_${group.name}`)
                          ? 'opacity-50 cursor-not-allowed'
                          : ''
                      }`}
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDeleteUserGroup(group.name)}
                      className={buttonStyles.roundedDanger}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {userGroups.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className='px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400'
                  >
                    暂无用户组，请添加用户组来管理用户权�?                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 用户列表 */}
      <div>
        <div className='flex items-center justify-between mb-3'>
          <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
            用户列表
          </h4>
          <div className='flex items-center space-x-2'>
            {/* 批量操作按钮 */}
            {selectedUsers.size > 0 && (
              <>
                <div className='flex items-center space-x-3'>
                  <span className='text-sm text-gray-600 dark:text-gray-400'>
                    已选择 {selectedUsers.size} 个用�?                  </span>
                  <button
                    onClick={() => setShowBatchUserGroupModal(true)}
                    className={buttonStyles.primary}
                  >
                    批量设置用户�?                  </button>
                </div>
                <div className='w-px h-6 bg-gray-300 dark:bg-gray-600'></div>
              </>
            )}
            <button
              onClick={() => {
                setShowAddUserForm(!showAddUserForm);
                if (showChangePasswordForm) {
                  setShowChangePasswordForm(false);
                  setChangePasswordUser({ username: '', password: '' });
                }
              }}
              className={
                showAddUserForm ? buttonStyles.secondary : buttonStyles.success
              }
            >
              {showAddUserForm ? '取消' : '添加用户'}
            </button>
          </div>
        </div>

        {/* 添加用户表单 */}
        {showAddUserForm && (
          <div className='mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700'>
            <div className='space-y-4'>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <input
                  type='text'
                  placeholder='用户�?
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                  className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
                />
                <input
                  type='password'
                  placeholder='密码'
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  用户组（可选）
                </label>
                <select
                  value={newUser.userGroup}
                  onChange={(e) =>
                    setNewUser((prev) => ({
                      ...prev,
                      userGroup: e.target.value,
                    }))
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
                >
                  <option value=''>无用户组（无限制�?/option>
                  {userGroups.map((group) => (
                    <option key={group.name} value={group.name}>
                      {group.name} (
                      {group.enabledApis && group.enabledApis.length > 0
                        ? `${group.enabledApis.length} 个源`
                        : '无限�?}
                      )
                    </option>
                  ))}
                </select>
              </div>
              <div className='flex justify-end'>
                <button
                  onClick={handleAddUser}
                  disabled={
                    !newUser.username ||
                    !newUser.password ||
                    isLoading('addUser')
                  }
                  className={
                    !newUser.username ||
                    !newUser.password ||
                    isLoading('addUser')
                      ? buttonStyles.disabled
                      : buttonStyles.success
                  }
                >
                  {isLoading('addUser') ? '添加�?..' : '添加'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 修改密码表单 */}
        {showChangePasswordForm && (
          <div className='mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700'>
            <h5 className='text-sm font-medium text-blue-800 dark:text-blue-300 mb-3'>
              修改用户密码
            </h5>
            <div className='flex flex-col sm:flex-row gap-4 sm:gap-3'>
              <input
                type='text'
                placeholder='用户�?
                value={changePasswordUser.username}
                disabled
                className='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-not-allowed'
              />
              <input
                type='password'
                placeholder='新密�?
                value={changePasswordUser.password}
                onChange={(e) =>
                  setChangePasswordUser((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                className='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              />
              <button
                onClick={handleChangePassword}
                disabled={
                  !changePasswordUser.password ||
                  isLoading(`changePassword_${changePasswordUser.username}`)
                }
                className={`w-full sm:w-auto ${
                  !changePasswordUser.password ||
                  isLoading(`changePassword_${changePasswordUser.username}`)
                    ? buttonStyles.disabled
                    : buttonStyles.primary
                }`}
              >
                {isLoading(`changePassword_${changePasswordUser.username}`)
                  ? '修改�?..'
                  : '修改密码'}
              </button>
              <button
                onClick={() => {
                  setShowChangePasswordForm(false);
                  setChangePasswordUser({ username: '', password: '' });
                }}
                className={`w-full sm:w-auto ${buttonStyles.secondary}`}
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 用户列表 */}
        <div className='relative'>
          {/* 迁移遮罩�?*/}
          {config.UserConfig.Users &&
            config.UserConfig.Users.filter((u) => u.role !== 'owner').length >
              0 && (
              <div className='absolute inset-0 z-20 backdrop-blur-sm bg-white/30 dark:bg-gray-900/30 rounded-lg flex items-center justify-center'>
                <div className='bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-yellow-200 dark:border-yellow-800 max-w-md'>
                  <div className='flex items-center gap-3 mb-4'>
                    <AlertTriangle className='w-6 h-6 text-yellow-600 dark:text-yellow-400' />
                    <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                      需要迁移数�?                    </h3>
                  </div>
                  <p className='text-sm text-gray-600 dark:text-gray-400 mb-4'>
                    检测到旧版用户数据，请先迁移到新的存储结构后再进行用户管理操作�?                  </p>
                  <p className='text-xs text-gray-500 dark:text-gray-500'>
                    请在上方�?用户统计"区域点击"立即迁移"按钮完成数据迁移�?                  </p>
                </div>
              </div>
            )}
          <div
            className='border border-gray-200 dark:border-gray-700 rounded-lg max-h-[28rem] overflow-y-auto overflow-x-auto relative'
            data-table='user-list'
          >
            <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
              <thead className='bg-gray-50 dark:bg-gray-900 sticky top-0 z-10'>
                <tr>
                  <th className='w-4' />
                  <th className='w-10 px-1 py-3 text-center'>
                    {(() => {
                      // 检查是否有权限操作任何用户
                      const hasAnyPermission = config?.UserConfig?.Users?.some(
                        (user) =>
                          role === 'owner' ||
                          (role === 'admin' &&
                            (user.role === 'user' ||
                              user.username === currentUsername))
                      );

                      return hasAnyPermission ? (
                        <input
                          type='checkbox'
                          checked={selectAllUsers}
                          onChange={(e) =>
                            handleSelectAllUsers(e.target.checked)
                          }
                          className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
                        />
                      ) : (
                        <div className='w-4 h-4' />
                      );
                    })()}
                  </th>
                  <th
                    scope='col'
                    className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                  >
                    用户�?                  </th>
                  <th
                    scope='col'
                    className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                  >
                    角色
                  </th>
                  <th
                    scope='col'
                    className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                  >
                    状�?                  </th>
                  <th
                    scope='col'
                    className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                  >
                    用户�?                  </th>
                  <th
                    scope='col'
                    className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                  >
                    采集源权�?                  </th>
                  <th
                    scope='col'
                    className='px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                  >
                    操作
                  </th>
                </tr>
              </thead>
              {/* 按规则排序用户：自己 -> 站长(若非自己) -> 管理�?-> 其他 */}
              {(() => {
                // 如果正在加载，显示加载状�?                if (userListLoading) {
                  return (
                    <tbody>
                      <tr>
                        <td
                          colSpan={7}
                          className='px-6 py-8 text-center text-gray-500 dark:text-gray-400'
                        >
                          加载�?..
                        </td>
                      </tr>
                    </tbody>
                  );
                }

                const sortedUsers = [...displayUsers].sort((a, b) => {
                  type UserInfo = (typeof displayUsers)[number];
                  const priority = (u: UserInfo) => {
                    if (u.username === currentUsername) return 0;
                    if (u.role === 'owner') return 1;
                    if (u.role === 'admin') return 2;
                    return 3;
                  };
                  return priority(a) - priority(b);
                });
                return (
                  <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                    {sortedUsers.map((user) => {
                      // 修改密码权限：站长可修改管理员和普通用户密码，管理员可修改普通用户和自己的密码，但任何人都不能修改站长密�?                      const canChangePassword =
                        user.role !== 'owner' && // 不能修改站长密码
                        (role === 'owner' || // 站长可以修改管理员和普通用户密�?                          (role === 'admin' &&
                            (user.role === 'user' ||
                              user.username === currentUsername))); // 管理员可以修改普通用户和自己的密�?
                      // 删除用户权限：站长可删除除自己外的所有用户，管理员仅可删除普通用�?                      const canDeleteUser =
                        user.username !== currentUsername &&
                        (role === 'owner' || // 站长可以删除除自己外的所有用�?                          (role === 'admin' && user.role === 'user')); // 管理员仅可删除普通用�?
                      // 其他操作权限：不能操作自己，站长可操作所有用户，管理员可操作普通用�?                      const canOperate =
                        user.username !== currentUsername &&
                        (role === 'owner' ||
                          (role === 'admin' && user.role === 'user'));
                      return (
                        <tr
                          key={user.username}
                          className='hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                        >
                          <td className='w-4' />
                          <td className='w-10 px-1 py-3 text-center'>
                            {role === 'owner' ||
                            (role === 'admin' &&
                              (user.role === 'user' ||
                                user.username === currentUsername)) ? (
                              <input
                                type='checkbox'
                                checked={selectedUsers.has(user.username)}
                                onChange={(e) =>
                                  handleSelectUser(
                                    user.username,
                                    e.target.checked
                                  )
                                }
                                className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
                              />
                            ) : (
                              <div className='w-4 h-4' />
                            )}
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100'>
                            <div className='flex items-center gap-2'>
                              <span>{user.username}</span>
                              {user.oidcSub && (
                                <span className='px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'>
                                  OIDC
                                </span>
                              )}
                            </div>
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap'>
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                user.role === 'owner'
                                  ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
                                  : user.role === 'admin'
                                  ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {user.role === 'owner'
                                ? '站长'
                                : user.role === 'admin'
                                ? '管理�?
                                : '普通用�?}
                            </span>
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap'>
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                !user.banned
                                  ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                                  : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                              }`}
                            >
                              {!user.banned ? '正常' : '已封�?}
                            </span>
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap'>
                            <div className='flex items-center space-x-2'>
                              <span className='text-sm text-gray-900 dark:text-gray-100'>
                                {user.tags && user.tags.length > 0
                                  ? user.tags.join(', ')
                                  : '无用户组'}
                              </span>
                              {/* 配置用户组按�?*/}
                              {(role === 'owner' ||
                                (role === 'admin' &&
                                  (user.role === 'user' ||
                                    user.username === currentUsername))) && (
                                <button
                                  onClick={() => handleConfigureUserGroup(user)}
                                  className={buttonStyles.roundedPrimary}
                                >
                                  配置
                                </button>
                              )}
                            </div>
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap'>
                            <div className='flex items-center space-x-2'>
                              <span className='text-sm text-gray-900 dark:text-gray-100'>
                                {user.enabledApis && user.enabledApis.length > 0
                                  ? `${user.enabledApis.length} 个源`
                                  : '无限�?}
                              </span>
                              {/* 配置采集源权限按�?*/}
                              {(role === 'owner' ||
                                (role === 'admin' &&
                                  (user.role === 'user' ||
                                    user.username === currentUsername))) && (
                                <button
                                  onClick={() => handleConfigureUserApis(user)}
                                  className={buttonStyles.roundedPrimary}
                                >
                                  配置
                                </button>
                              )}
                            </div>
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
                            {/* 修改密码按钮 */}
                            {canChangePassword && (
                              <button
                                onClick={() =>
                                  handleShowChangePasswordForm(user.username)
                                }
                                className={buttonStyles.roundedPrimary}
                              >
                                修改密码
                              </button>
                            )}
                            {canOperate && (
                              <>
                                {/* 其他操作按钮 */}
                                {user.role === 'user' && (
                                  <button
                                    onClick={() =>
                                      handleSetAdmin(user.username)
                                    }
                                    disabled={isLoading(
                                      `setAdmin_${user.username}`
                                    )}
                                    className={`${buttonStyles.roundedPurple} ${
                                      isLoading(`setAdmin_${user.username}`)
                                        ? 'opacity-50 cursor-not-allowed'
                                        : ''
                                    }`}
                                  >
                                    设为管理
                                  </button>
                                )}
                                {user.role === 'admin' && (
                                  <button
                                    onClick={() =>
                                      handleRemoveAdmin(user.username)
                                    }
                                    disabled={isLoading(
                                      `removeAdmin_${user.username}`
                                    )}
                                    className={`${
                                      buttonStyles.roundedSecondary
                                    } ${
                                      isLoading(`removeAdmin_${user.username}`)
                                        ? 'opacity-50 cursor-not-allowed'
                                        : ''
                                    }`}
                                  >
                                    取消管理
                                  </button>
                                )}
                                {user.role !== 'owner' &&
                                  (!user.banned ? (
                                    <button
                                      onClick={() =>
                                        handleBanUser(user.username)
                                      }
                                      disabled={isLoading(
                                        `banUser_${user.username}`
                                      )}
                                      className={`${
                                        buttonStyles.roundedDanger
                                      } ${
                                        isLoading(`banUser_${user.username}`)
                                          ? 'opacity-50 cursor-not-allowed'
                                          : ''
                                      }`}
                                    >
                                      封禁
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        handleUnbanUser(user.username)
                                      }
                                      disabled={isLoading(
                                        `unbanUser_${user.username}`
                                      )}
                                      className={`${
                                        buttonStyles.roundedSuccess
                                      } ${
                                        isLoading(`unbanUser_${user.username}`)
                                          ? 'opacity-50 cursor-not-allowed'
                                          : ''
                                      }`}
                                    >
                                      解封
                                    </button>
                                  ))}
                              </>
                            )}
                            {/* 删除用户按钮 - 放在最后，使用更明显的红色样式 */}
                            {canDeleteUser && (
                              <button
                                onClick={() => handleDeleteUser(user.username)}
                                className={buttonStyles.roundedDanger}
                              >
                                删除用户
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })()}
            </table>
          </div>

          {/* 用户列表分页 */}
          {!hasOldUserData && usersV2 && userTotalPages > 1 && (
            <div className='mt-4 flex items-center justify-between px-4'>
              <div className='text-sm text-gray-600 dark:text-gray-400'>
                �?{userTotal} 个用户，�?{userPage} / {userTotalPages} �?              </div>
              <div className='flex items-center space-x-2'>
                <button
                  onClick={() => fetchUsersV2(1)}
                  disabled={userPage === 1}
                  className={`px-3 py-1 text-sm rounded ${
                    userPage === 1
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  首页
                </button>
                <button
                  onClick={() => fetchUsersV2(userPage - 1)}
                  disabled={userPage === 1}
                  className={`px-3 py-1 text-sm rounded ${
                    userPage === 1
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  上一�?                </button>
                <button
                  onClick={() => fetchUsersV2(userPage + 1)}
                  disabled={userPage === userTotalPages}
                  className={`px-3 py-1 text-sm rounded ${
                    userPage === userTotalPages
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  下一�?                </button>
                <button
                  onClick={() => fetchUsersV2(userTotalPages)}
                  disabled={userPage === userTotalPages}
                  className={`px-3 py-1 text-sm rounded ${
                    userPage === userTotalPages
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  末页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 配置用户采集源权限弹�?*/}
      {showConfigureApisModal &&
        selectedUser &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => {
              setShowConfigureApisModal(false);
              setSelectedUser(null);
              setSelectedApis([]);
            }}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    配置用户采集源权�?- {selectedUser.username}
                  </h3>
                  <button
                    onClick={() => {
                      setShowConfigureApisModal(false);
                      setSelectedUser(null);
                      setSelectedApis([]);
                    }}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='mb-6'>
                  <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
                    <div className='flex items-center space-x-2 mb-2'>
                      <svg
                        className='w-5 h-5 text-blue-600 dark:text-blue-400'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                        />
                      </svg>
                      <span className='text-sm font-medium text-blue-800 dark:text-blue-300'>
                        配置说明
                      </span>
                    </div>
                    <p className='text-sm text-blue-700 dark:text-blue-400 mt-1'>
                      提示：全不选为无限制，选中的采集源将限制用户只能访问这些源
                    </p>
                  </div>
                </div>

                {/* 采集源选择 - 多列布局 */}
                <div className='mb-6'>
                  <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-4'>
                    选择可用的采集源�?                  </h4>
                  <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                    {config?.SourceConfig?.map((source) => (
                      <label
                        key={source.key}
                        className='flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors'
                      >
                        <input
                          type='checkbox'
                          checked={selectedApis.includes(source.key)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedApis([...selectedApis, source.key]);
                            } else {
                              setSelectedApis(
                                selectedApis.filter((api) => api !== source.key)
                              );
                            }
                          }}
                          className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700'
                        />
                        <div className='flex-1 min-w-0'>
                          <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
                            {source.name}
                          </div>
                          {source.api && (
                            <div className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                              {extractDomain(source.api)}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 快速操作按�?*/}
                <div className='flex flex-wrap items-center justify-between mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg'>
                  <div className='flex space-x-2'>
                    <button
                      onClick={() => setSelectedApis([])}
                      className={buttonStyles.quickAction}
                    >
                      全不选（无限制）
                    </button>
                    <button
                      onClick={() => {
                        const allApis =
                          config?.SourceConfig?.filter(
                            (source) => !source.disabled
                          ).map((s) => s.key) || [];
                        setSelectedApis(allApis);
                      }}
                      className={buttonStyles.quickAction}
                    >
                      全�?                    </button>
                  </div>
                  <div className='text-sm text-gray-600 dark:text-gray-400'>
                    已选择�?                    <span className='font-medium text-blue-600 dark:text-blue-400'>
                      {selectedApis.length > 0
                        ? `${selectedApis.length} 个源`
                        : '无限�?}
                    </span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={() => {
                      setShowConfigureApisModal(false);
                      setSelectedUser(null);
                      setSelectedApis([]);
                    }}
                    className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.secondary}`}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveUserApis}
                    disabled={isLoading(
                      `saveUserApis_${selectedUser?.username}`
                    )}
                    className={`px-6 py-2.5 text-sm font-medium ${
                      isLoading(`saveUserApis_${selectedUser?.username}`)
                        ? buttonStyles.disabled
                        : buttonStyles.success
                    }`}
                  >
                    {isLoading(`saveUserApis_${selectedUser?.username}`)
                      ? '配置�?..'
                      : '确认配置'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 添加用户组弹�?*/}
      {showAddUserGroupForm &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => {
              setShowAddUserGroupForm(false);
              setNewUserGroup({
                name: '',
                enabledApis: [],
                permissions: [...DEFAULT_GROUP_PERMISSIONS],
              });
            }}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    添加新用户组
                  </h3>
                  <button
                    onClick={() => {
                      setShowAddUserGroupForm(false);
                      setNewUserGroup({
                        name: '',
                        enabledApis: [],
                        permissions: [...DEFAULT_GROUP_PERMISSIONS],
                      });
                    }}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='space-y-6'>
                  {/* 用户组名�?*/}
                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      用户组名�?                    </label>
                    <input
                      type='text'
                      placeholder='请输入用户组名称'
                      value={newUserGroup.name}
                      onChange={(e) =>
                        setNewUserGroup((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    />
                  </div>

                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4'>
                      功能权限
                    </label>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                      {FEATURE_PERMISSION_OPTIONS.map((permission) => (
                        <label
                          key={permission.key}
                          className='flex items-start space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors'
                        >
                          <input
                            type='checkbox'
                            checked={newUserGroup.permissions.includes(
                              permission.key
                            )}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewUserGroup((prev) => ({
                                  ...prev,
                                  permissions: [
                                    ...prev.permissions,
                                    permission.key,
                                  ],
                                }));
                              } else {
                                setNewUserGroup((prev) => ({
                                  ...prev,
                                  permissions: prev.permissions.filter(
                                    (item) => item !== permission.key
                                  ),
                                }));
                              }
                            }}
                            className='mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700'
                          />
                          <div className='flex-1 min-w-0'>
                            <div className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                              {permission.label}
                            </div>
                            <div className='text-xs text-gray-500 dark:text-gray-400'>
                              {permission.description}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className='mt-4 flex space-x-2'>
                      <button
                        type='button'
                        onClick={() =>
                          setNewUserGroup((prev) => ({
                            ...prev,
                            permissions: [],
                          }))
                        }
                        className={buttonStyles.quickAction}
                      >
                        全不�?                      </button>
                      <button
                        type='button'
                        onClick={() =>
                          setNewUserGroup((prev) => ({
                            ...prev,
                            permissions: [...DEFAULT_GROUP_PERMISSIONS],
                          }))
                        }
                        className={buttonStyles.quickAction}
                      >
                        全�?                      </button>
                    </div>
                  </div>

                  {/* 可用视频�?*/}
                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4'>
                      可用视频�?                    </label>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
                      {config?.SourceConfig?.map((source) => (
                        <label
                          key={source.key}
                          className='flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors'
                        >
                          <input
                            type='checkbox'
                            checked={newUserGroup.enabledApis.includes(
                              source.key
                            )}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewUserGroup((prev) => ({
                                  ...prev,
                                  enabledApis: [
                                    ...prev.enabledApis,
                                    source.key,
                                  ],
                                }));
                              } else {
                                setNewUserGroup((prev) => ({
                                  ...prev,
                                  enabledApis: prev.enabledApis.filter(
                                    (api) => api !== source.key
                                  ),
                                }));
                              }
                            }}
                            className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700'
                          />
                          <div className='flex-1 min-w-0'>
                            <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
                              {source.name}
                            </div>
                            {source.api && (
                              <div className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                                {extractDomain(source.api)}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>

                    {/* 快速操作按�?*/}
                    <div className='mt-4 flex space-x-2'>
                      <button
                        onClick={() =>
                          setNewUserGroup((prev) => ({
                            ...prev,
                            enabledApis: [],
                          }))
                        }
                        className={buttonStyles.quickAction}
                      >
                        全不选（无限制）
                      </button>
                      <button
                        onClick={() => {
                          const allApis =
                            config?.SourceConfig?.filter(
                              (source) => !source.disabled
                            ).map((s) => s.key) || [];
                          setNewUserGroup((prev) => ({
                            ...prev,
                            enabledApis: allApis,
                          }));
                        }}
                        className={buttonStyles.quickAction}
                      >
                        全�?                      </button>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className='flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700'>
                    <button
                      onClick={() => {
                        setShowAddUserGroupForm(false);
                        setNewUserGroup({
                          name: '',
                          enabledApis: [],
                          permissions: [...DEFAULT_GROUP_PERMISSIONS],
                        });
                      }}
                      className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.secondary}`}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleAddUserGroup}
                      disabled={
                        !newUserGroup.name.trim() ||
                        isLoading('userGroup_add_new')
                      }
                      className={`px-6 py-2.5 text-sm font-medium ${
                        !newUserGroup.name.trim() ||
                        isLoading('userGroup_add_new')
                          ? buttonStyles.disabled
                          : buttonStyles.primary
                      }`}
                    >
                      {isLoading('userGroup_add_new')
                        ? '添加�?..'
                        : '添加用户�?}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 编辑用户组弹�?*/}
      {showEditUserGroupForm &&
        editingUserGroup &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => {
              setShowEditUserGroupForm(false);
              setEditingUserGroup(null);
            }}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    编辑用户�?- {editingUserGroup.name}
                  </h3>
                  <button
                    onClick={() => {
                      setShowEditUserGroupForm(false);
                      setEditingUserGroup(null);
                    }}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='space-y-6'>
                  {/* 可用视频�?*/}
                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4'>
                      可用视频�?                    </label>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
                      {config?.SourceConfig?.map((source) => (
                        <label
                          key={source.key}
                          className='flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors'
                        >
                          <input
                            type='checkbox'
                            checked={editingUserGroup.enabledApis.includes(
                              source.key
                            )}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditingUserGroup((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        enabledApis: [
                                          ...prev.enabledApis,
                                          source.key,
                                        ],
                                      }
                                    : null
                                );
                              } else {
                                setEditingUserGroup((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        enabledApis: prev.enabledApis.filter(
                                          (api) => api !== source.key
                                        ),
                                      }
                                    : null
                                );
                              }
                            }}
                            className='rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700'
                          />
                          <div className='flex-1 min-w-0'>
                            <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
                              {source.name}
                            </div>
                            {source.api && (
                              <div className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                                {extractDomain(source.api)}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>

                    {/* 快速操作按�?*/}
                    <div className='mt-4 flex space-x-2'>
                      <button
                        onClick={() =>
                          setEditingUserGroup((prev) =>
                            prev ? { ...prev, enabledApis: [] } : null
                          )
                        }
                        className={buttonStyles.quickAction}
                      >
                        全不选（无限制）
                      </button>
                      <button
                        onClick={() => {
                          const allApis =
                            config?.SourceConfig?.filter(
                              (source) => !source.disabled
                            ).map((s) => s.key) || [];
                          setEditingUserGroup((prev) =>
                            prev ? { ...prev, enabledApis: allApis } : null
                          );
                        }}
                        className={buttonStyles.quickAction}
                      >
                        全�?                      </button>
                    </div>
                  </div>

                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4'>
                      功能权限
                    </label>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                      {FEATURE_PERMISSION_OPTIONS.map((permission) => (
                        <label
                          key={permission.key}
                          className='flex items-start space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors'
                        >
                          <input
                            type='checkbox'
                            checked={editingUserGroup.permissions.includes(
                              permission.key
                            )}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditingUserGroup((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        permissions: [
                                          ...prev.permissions,
                                          permission.key,
                                        ],
                                      }
                                    : null
                                );
                              } else {
                                setEditingUserGroup((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        permissions: prev.permissions.filter(
                                          (item) => item !== permission.key
                                        ),
                                      }
                                    : null
                                );
                              }
                            }}
                            className='mt-0.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700'
                          />
                          <div className='flex-1 min-w-0'>
                            <div className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                              {permission.label}
                            </div>
                            <div className='text-xs text-gray-500 dark:text-gray-400'>
                              {permission.description}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className='mt-4 flex space-x-2'>
                      <button
                        type='button'
                        onClick={() =>
                          setEditingUserGroup((prev) =>
                            prev ? { ...prev, permissions: [] } : null
                          )
                        }
                        className={buttonStyles.quickAction}
                      >
                        全不�?                      </button>
                      <button
                        type='button'
                        onClick={() =>
                          setEditingUserGroup((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  permissions: [...DEFAULT_GROUP_PERMISSIONS],
                                }
                              : null
                          )
                        }
                        className={buttonStyles.quickAction}
                      >
                        全�?                      </button>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className='flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700'>
                    <button
                      onClick={() => {
                        setShowEditUserGroupForm(false);
                        setEditingUserGroup(null);
                      }}
                      className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.secondary}`}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleEditUserGroup}
                      disabled={isLoading(
                        `userGroup_edit_${editingUserGroup?.name}`
                      )}
                      className={`px-6 py-2.5 text-sm font-medium ${
                        isLoading(`userGroup_edit_${editingUserGroup?.name}`)
                          ? buttonStyles.disabled
                          : buttonStyles.primary
                      }`}
                    >
                      {isLoading(`userGroup_edit_${editingUserGroup?.name}`)
                        ? '保存�?..'
                        : '保存修改'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 配置用户组弹�?*/}
      {showConfigureUserGroupModal &&
        selectedUserForGroup &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => {
              setShowConfigureUserGroupModal(false);
              setSelectedUserForGroup(null);
              setSelectedUserGroups([]);
            }}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    配置用户�?- {selectedUserForGroup.username}
                  </h3>
                  <button
                    onClick={() => {
                      setShowConfigureUserGroupModal(false);
                      setSelectedUserForGroup(null);
                      setSelectedUserGroups([]);
                    }}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='mb-6'>
                  <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
                    <div className='flex items-center space-x-2 mb-2'>
                      <svg
                        className='w-5 h-5 text-blue-600 dark:text-blue-400'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                        />
                      </svg>
                      <span className='text-sm font-medium text-blue-800 dark:text-blue-300'>
                        配置说明
                      </span>
                    </div>
                    <p className='text-sm text-blue-700 dark:text-blue-400 mt-1'>
                      提示：选择"无用户组"为无限制，选择特定用户组将限制用户只能访问该用户组允许的采集源
                    </p>
                  </div>
                </div>

                {/* 用户组选择 - 下拉选择�?*/}
                <div className='mb-6'>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    选择用户组：
                  </label>
                  <select
                    value={
                      selectedUserGroups.length > 0 ? selectedUserGroups[0] : ''
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedUserGroups(value ? [value] : []);
                    }}
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors'
                  >
                    <option value=''>无用户组（无限制�?/option>
                    {userGroups.map((group) => (
                      <option key={group.name} value={group.name}>
                        {group.name}{' '}
                        {group.enabledApis && group.enabledApis.length > 0
                          ? `(${group.enabledApis.length} 个源)`
                          : ''}
                      </option>
                    ))}
                  </select>
                  <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
                    选择"无用户组"为无限制，选择特定用户组将限制用户只能访问该用户组允许的采集源
                  </p>
                </div>

                {/* 操作按钮 */}
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={() => {
                      setShowConfigureUserGroupModal(false);
                      setSelectedUserForGroup(null);
                      setSelectedUserGroups([]);
                    }}
                    className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.secondary}`}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveUserGroups}
                    disabled={isLoading(
                      `saveUserGroups_${selectedUserForGroup?.username}`
                    )}
                    className={`px-6 py-2.5 text-sm font-medium ${
                      isLoading(
                        `saveUserGroups_${selectedUserForGroup?.username}`
                      )
                        ? buttonStyles.disabled
                        : buttonStyles.success
                    }`}
                  >
                    {isLoading(
                      `saveUserGroups_${selectedUserForGroup?.username}`
                    )
                      ? '配置�?..'
                      : '确认配置'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 删除用户组确认弹�?*/}
      {showDeleteUserGroupModal &&
        deletingUserGroup &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => {
              setShowDeleteUserGroupModal(false);
              setDeletingUserGroup(null);
            }}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    确认删除用户�?                  </h3>
                  <button
                    onClick={() => {
                      setShowDeleteUserGroupModal(false);
                      setDeletingUserGroup(null);
                    }}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='mb-6'>
                  <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4'>
                    <div className='flex items-center space-x-2 mb-2'>
                      <svg
                        className='w-5 h-5 text-red-600 dark:text-red-400'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                        />
                      </svg>
                      <span className='text-sm font-medium text-red-800 dark:text-red-300'>
                        危险操作警告
                      </span>
                    </div>
                    <p className='text-sm text-red-700 dark:text-red-400'>
                      删除用户�?<strong>{deletingUserGroup.name}</strong>{' '}
                      将影响所有使用该组的用户，此操作不可恢复�?                    </p>
                  </div>

                  {deletingUserGroup.affectedUsers.length > 0 ? (
                    <div className='bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4'>
                      <div className='flex items-center space-x-2 mb-2'>
                        <svg
                          className='w-5 h-5 text-yellow-600 dark:text-yellow-400'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                          />
                        </svg>
                        <span className='text-sm font-medium text-yellow-800 dark:text-yellow-300'>
                          ⚠️ 将影�?{deletingUserGroup.affectedUsers.length}{' '}
                          个用户：
                        </span>
                      </div>
                      <div className='space-y-1'>
                        {deletingUserGroup.affectedUsers.map((user, index) => (
                          <div
                            key={index}
                            className='text-sm text-yellow-700 dark:text-yellow-300'
                          >
                            �?{user.username} ({user.role})
                          </div>
                        ))}
                      </div>
                      <p className='text-xs text-yellow-600 dark:text-yellow-400 mt-2'>
                        这些用户的用户组将被自动移除
                      </p>
                    </div>
                  ) : (
                    <div className='bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4'>
                      <div className='flex items-center space-x-2'>
                        <svg
                          className='w-5 h-5 text-green-600 dark:text-green-400'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M5 13l4 4L19 7'
                          />
                        </svg>
                        <span className='text-sm font-medium text-green-800 dark:text-green-300'>
                          �?当前没有用户使用此用户组
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={() => {
                      setShowDeleteUserGroupModal(false);
                      setDeletingUserGroup(null);
                    }}
                    className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.secondary}`}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmDeleteUserGroup}
                    disabled={isLoading(
                      `userGroup_delete_${deletingUserGroup?.name}`
                    )}
                    className={`px-6 py-2.5 text-sm font-medium ${
                      isLoading(`userGroup_delete_${deletingUserGroup?.name}`)
                        ? buttonStyles.disabled
                        : buttonStyles.danger
                    }`}
                  >
                    {isLoading(`userGroup_delete_${deletingUserGroup?.name}`)
                      ? '删除�?..'
                      : '确认删除'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 删除用户确认弹窗 */}
      {showDeleteUserModal &&
        deletingUser &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => {
              setShowDeleteUserModal(false);
              setDeletingUser(null);
            }}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    确认删除用户
                  </h3>
                  <button
                    onClick={() => {
                      setShowDeleteUserModal(false);
                      setDeletingUser(null);
                    }}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='mb-6'>
                  <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4'>
                    <div className='flex items-center space-x-2 mb-2'>
                      <svg
                        className='w-5 h-5 text-red-600 dark:text-red-400'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                        />
                      </svg>
                      <span className='text-sm font-medium text-red-800 dark:text-red-300'>
                        危险操作警告
                      </span>
                    </div>
                    <p className='text-sm text-red-700 dark:text-red-400'>
                      删除用户 <strong>{deletingUser}</strong>{' '}
                      将同时删除其搜索历史、播放记录和收藏夹，此操作不可恢复！
                    </p>
                  </div>

                  {/* 操作按钮 */}
                  <div className='flex justify-end space-x-3'>
                    <button
                      onClick={() => {
                        setShowDeleteUserModal(false);
                        setDeletingUser(null);
                      }}
                      className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.secondary}`}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleConfirmDeleteUser}
                      className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.danger}`}
                    >
                      确认删除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 批量设置用户组弹�?*/}
      {showBatchUserGroupModal &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => {
              setShowBatchUserGroupModal(false);
              setSelectedUserGroup('');
            }}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    批量设置用户�?                  </h3>
                  <button
                    onClick={() => {
                      setShowBatchUserGroupModal(false);
                      setSelectedUserGroup('');
                    }}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='mb-6'>
                  <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4'>
                    <div className='flex items-center space-x-2 mb-2'>
                      <svg
                        className='w-5 h-5 text-blue-600 dark:text-blue-400'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                        />
                      </svg>
                      <span className='text-sm font-medium text-blue-800 dark:text-blue-300'>
                        批量操作说明
                      </span>
                    </div>
                    <p className='text-sm text-blue-700 dark:text-blue-400'>
                      将为选中�?<strong>{selectedUsers.size} 个用�?/strong>{' '}
                      设置用户组，选择"无用户组"为无限制
                    </p>
                  </div>

                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      选择用户组：
                    </label>
                    <select
                      onChange={(e) => setSelectedUserGroup(e.target.value)}
                      className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors'
                      value={selectedUserGroup}
                    >
                      <option value=''>无用户组（无限制�?/option>
                      {userGroups.map((group) => (
                        <option key={group.name} value={group.name}>
                          {group.name}{' '}
                          {group.enabledApis && group.enabledApis.length > 0
                            ? `(${group.enabledApis.length} 个源)`
                            : ''}
                        </option>
                      ))}
                    </select>
                    <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
                      选择"无用户组"为无限制，选择特定用户组将限制用户只能访问该用户组允许的采集源
                    </p>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={() => {
                      setShowBatchUserGroupModal(false);
                      setSelectedUserGroup('');
                    }}
                    className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.secondary}`}
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleBatchSetUserGroup(selectedUserGroup)}
                    disabled={isLoading('batchSetUserGroup')}
                    className={`px-6 py-2.5 text-sm font-medium ${
                      isLoading('batchSetUserGroup')
                        ? buttonStyles.disabled
                        : buttonStyles.success
                    }`}
                  >
                    {isLoading('batchSetUserGroup') ? '设置�?..' : '确认设置'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
        onConfirm={alertModal.onConfirm}
      />
    </div>
  );
};

// 私人影库配置组件
const OpenListConfigComponent = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rootPaths, setRootPaths] = useState<string[]>(['/']);
  const [offlineDownloadPath, setOfflineDownloadPath] = useState('/');
  const [scanInterval, setScanInterval] = useState(0);
  const [scanMode, setScanMode] = useState<'torrent' | 'name' | 'hybrid'>(
    'hybrid'
  );
  const [disableVideoPreview, setDisableVideoPreview] = useState(false);
  const [videos, setVideos] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    current: number;
    total: number;
    currentFolder?: string;
  } | null>(null);
  const [correctDialogOpen, setCorrectDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);

  useEffect(() => {
    if (config?.OpenListConfig) {
      setEnabled(config.OpenListConfig.Enabled || false);
      setUrl(config.OpenListConfig.URL || '');
      setUsername(config.OpenListConfig.Username || '');
      setPassword(config.OpenListConfig.Password || '');
      setRootPaths(
        config.OpenListConfig.RootPaths ||
          (config.OpenListConfig.RootPath
            ? [config.OpenListConfig.RootPath]
            : ['/'])
      );
      setOfflineDownloadPath(config.OpenListConfig.OfflineDownloadPath || '/');
      setScanInterval(config.OpenListConfig.ScanInterval || 0);
      setScanMode(config.OpenListConfig.ScanMode || 'hybrid');
      setDisableVideoPreview(
        config.OpenListConfig.DisableVideoPreview || false
      );
    }
  }, [config]);

  useEffect(() => {
    if (
      config?.OpenListConfig?.URL &&
      config?.OpenListConfig?.Username &&
      config?.OpenListConfig?.Password
    ) {
      fetchVideos();
    }
  }, [config]);

  const fetchVideos = async (noCache = false) => {
    try {
      setRefreshing(true);
      const url = `/api/openlist/list?page=1&pageSize=100&includeFailed=true${
        noCache ? '&noCache=true' : ''
      }`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setVideos(data.list || []);
      }
    } catch (error) {
      console.error('获取视频列表失败:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSave = async () => {
    await withLoading('saveOpenList', async () => {
      try {
        const response = await fetch('/api/admin/openlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            Enabled: enabled,
            URL: url,
            Username: username,
            Password: password,
            RootPaths: rootPaths,
            OfflineDownloadPath: offlineDownloadPath,
            ScanInterval: scanInterval,
            ScanMode: scanMode,
            DisableVideoPreview: disableVideoPreview,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '保存失败');
        }

        showSuccess('保存成功', showAlert);
        await refreshConfig();
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '保存失败',
          showAlert
        );
        throw error;
      }
    });
  };

  const handleRefresh = async (clearMetaInfo = false) => {
    setRefreshing(true);
    setScanProgress(null);
    try {
      const response = await fetch('/api/openlist/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearMetaInfo }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '刷新失败');
      }

      const result = await response.json();
      const taskId = result.taskId;

      if (!taskId) {
        throw new Error('未获取到任务ID');
      }

      // 轮询任务进度
      const pollInterval = setInterval(async () => {
        try {
          const progressResponse = await fetch(
            `/api/openlist/scan-progress?taskId=${taskId}`
          );

          if (!progressResponse.ok) {
            clearInterval(pollInterval);
            throw new Error('获取进度失败');
          }

          const progressData = await progressResponse.json();
          const task = progressData.task;

          if (task.status === 'running') {
            setScanProgress(task.progress);
          } else if (task.status === 'completed') {
            clearInterval(pollInterval);
            setScanProgress(null);
            setRefreshing(false);
            showSuccess(
              `扫描完成！新�?${task.result.new} 个，已存�?${task.result.existing} 个，失败 ${task.result.errors} 个`,
              showAlert
            );
            // 先强制从数据库读取视频列表（这会更新缓存�?            await fetchVideos(true);
            // 然后再刷新配置（这会触发 useEffect，但此时缓存已经是新的了�?            await refreshConfig();
          } else if (task.status === 'failed') {
            clearInterval(pollInterval);
            setScanProgress(null);
            setRefreshing(false);
            throw new Error(task.error || '扫描失败');
          }
        } catch (error) {
          clearInterval(pollInterval);
          setScanProgress(null);
          setRefreshing(false);
          showError(
            error instanceof Error ? error.message : '获取进度失败',
            showAlert
          );
        }
      }, 1000);
    } catch (error) {
      setScanProgress(null);
      setRefreshing(false);
      showError(error instanceof Error ? error.message : '刷新失败', showAlert);
    }
  };

  const handleRefreshVideo = async (folder: string) => {
    try {
      const response = await fetch('/api/openlist/refresh-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '刷新失败');
      }

      showSuccess('刷新成功', showAlert);
    } catch (error) {
      showError(error instanceof Error ? error.message : '刷新失败', showAlert);
    }
  };

  const handleCorrectSuccess = () => {
    fetchVideos(true); // 强制从数据库重新读取，不使用缓存
  };

  const handleCheckConnectivity = async () => {
    await withLoading('checkOpenList', async () => {
      try {
        const response = await fetch('/api/openlist/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url,
            username,
            password,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          showSuccess('连接成功', showAlert);
        } else {
          throw new Error(data.error || '连接失败');
        }
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '连接失败',
          showAlert
        );
        throw error;
      }
    });
  };

  const handleDeleteVideo = async (key: string, title: string) => {
    // 显示确认对话框，直接�?onConfirm 中执行删除操�?    showAlert({
      type: 'warning',
      title: '确认删除',
      message: `确定要删除视频记�?${title}"吗？此操作不会删除实际文件，只会从列表中移除。`,
      showConfirm: true,
      onConfirm: async () => {
        try {
          const response = await fetch('/api/openlist/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key }),
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || '删除失败');
          }

          showSuccess('删除成功', showAlert);
          await fetchVideos(true); // 强制从数据库重新读取
          refreshConfig(); // 异步刷新配置以更新资源数量（不等待，避免重复刷新�?        } catch (error) {
          showError(
            error instanceof Error ? error.message : '删除失败',
            showAlert
          );
        }
      },
    });
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '未刷�?;
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  return (
    <div className='space-y-6'>
      {/* 使用说明 */}
      <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
        <div className='flex items-center gap-2 mb-2'>
          <svg
            className='w-5 h-5 text-blue-600 dark:text-blue-400'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
            />
          </svg>
          <span className='text-sm font-medium text-blue-800 dark:text-blue-300'>
            使用说明
          </span>
        </div>
        <div className='text-sm text-blue-700 dark:text-blue-400 space-y-1'>
          <p>
            �?私人影库功能需要配�?OpenList 使用，用于管理和播放您自己的视频文件
          </p>
          <p>
            �?OpenList
            是一个开源的网盘聚合程序，支持多种存储后端（本地、阿里云盘、OneDrive
            等）
          </p>
          <p>
            �?配置后，系统会自动扫描指定目录下的视频文件夹，并通过 TMDB
            匹配元数据信�?          </p>
          <p>�?定时扫描间隔设置�?0 表示关闭自动扫描，最低间隔为 60 分钟</p>
          <p>�?视频文件夹名称为影片名称，精准命名可以提�?TMDB 匹配准确�?/p>
        </div>
      </div>

      {/* 功能开�?*/}
      <div className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
        <div>
          <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
            启用私人影库功能
          </h3>
          <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
            关闭后将不显示私人影库入口，也不会执行定时扫�?          </p>
        </div>
        <label className='relative inline-flex items-center cursor-pointer'>
          <input
            type='checkbox'
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className='sr-only peer'
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {/* 配置表单 */}
      <div className='space-y-4'>
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            OpenList URL
          </label>
          <input
            type='text'
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={!enabled}
            placeholder='https://your-openlist-server.com'
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
          />
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              账号
            </label>
            <input
              type='text'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={!enabled}
              placeholder='admin'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              密码
            </label>
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!enabled}
              placeholder='password'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
            />
          </div>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            根目录列�?          </label>
          <div className='space-y-2'>
            {rootPaths.map((path, index) => (
              <div key={index} className='flex gap-2'>
                <input
                  type='text'
                  value={path}
                  onChange={(e) => {
                    const newPaths = [...rootPaths];
                    newPaths[index] = e.target.value;
                    setRootPaths(newPaths);
                  }}
                  disabled={!enabled}
                  placeholder='/'
                  className='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
                />
                {rootPaths.length > 1 && (
                  <button
                    type='button'
                    onClick={() => {
                      const newPaths = rootPaths.filter((_, i) => i !== index);
                      setRootPaths(newPaths);
                    }}
                    disabled={!enabled}
                    className='px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    删除
                  </button>
                )}
              </div>
            ))}
            <button
              type='button'
              onClick={() => setRootPaths([...rootPaths, '/'])}
              disabled={!enabled}
              className='w-full px-3 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              + 添加根目�?            </button>
          </div>
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            OpenList 中的视频文件夹路径，可以配置多个根目�?          </p>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            离线下载目录
          </label>
          <input
            type='text'
            value={offlineDownloadPath}
            onChange={(e) => setOfflineDownloadPath(e.target.value)}
            disabled={!enabled}
            placeholder='/'
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
          />
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            动漫磁力等离线下载任务的保存目录，默认为根目�?/
          </p>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            定时扫描间隔（分钟）
          </label>
          <input
            type='number'
            value={scanInterval}
            onChange={(e) => setScanInterval(parseInt(e.target.value) || 0)}
            disabled={!enabled}
            placeholder='0'
            min='0'
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
          />
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            设置�?0 关闭定时扫描，最�?60 分钟
          </p>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            扫描模式
          </label>
          <select
            value={scanMode}
            onChange={(e) =>
              setScanMode(e.target.value as 'torrent' | 'name' | 'hybrid')
            }
            disabled={!enabled}
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <option value='hybrid'>混合模式（推荐）</option>
            <option value='torrent'>种子库匹�?/option>
            <option value='name'>名字匹配</option>
          </select>
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            混合模式：先用种子库匹配，失败后降级为名字匹�?          </p>
        </div>

        <div className='flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700'>
          <div>
            <h3 className='text-sm font-medium text-gray-900 dark:text-white'>
              禁用预览视频
            </h3>
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
              开启后将直接返回直连链接，不使用视频预览流
            </p>
          </div>
          <button
            onClick={() => setDisableVideoPreview(!disableVideoPreview)}
            disabled={!enabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              disableVideoPreview
                ? 'bg-blue-600'
                : 'bg-gray-200 dark:bg-gray-700'
            } ${!enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                disableVideoPreview ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className='flex gap-3'>
          <button
            onClick={handleCheckConnectivity}
            disabled={
              !enabled ||
              !url ||
              !username ||
              !password ||
              isLoading('checkOpenList')
            }
            className={buttonStyles.primary}
          >
            {isLoading('checkOpenList') ? '检查中...' : '检查连通�?}
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading('saveOpenList')}
            className={buttonStyles.success}
          >
            {isLoading('saveOpenList') ? '保存�?..' : '保存配置'}
          </button>
        </div>
      </div>

      {/* 视频列表区域 */}
      {enabled &&
        config?.OpenListConfig?.URL &&
        config?.OpenListConfig?.Username &&
        config?.OpenListConfig?.Password && (
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div>
                <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100'>
                  视频列表
                </h3>
                <div className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
                  <span>
                    资源�? {config.OpenListConfig.ResourceCount || 0}
                  </span>
                  <span className='mx-2'>|</span>
                  <span>
                    上次更新:{' '}
                    {formatDate(config.OpenListConfig.LastRefreshTime)}
                  </span>
                </div>
              </div>
              <div className='flex gap-3'>
                <button
                  onClick={() => handleRefresh(true)}
                  disabled={refreshing}
                  className={buttonStyles.warning}
                >
                  {refreshing ? '扫描�?..' : '重新扫描'}
                </button>
                <button
                  onClick={() => handleRefresh(false)}
                  disabled={refreshing}
                  className={buttonStyles.primary}
                >
                  {refreshing ? '扫描�?..' : '立即扫描'}
                </button>
              </div>
            </div>

            {refreshing && scanProgress && (
              <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4'>
                <div className='flex items-center justify-between mb-2'>
                  <span className='text-sm font-medium text-blue-900 dark:text-blue-100'>
                    扫描进度: {scanProgress.current} / {scanProgress.total}
                  </span>
                  <span className='text-sm text-blue-700 dark:text-blue-300'>
                    {scanProgress.total > 0
                      ? Math.round(
                          (scanProgress.current / scanProgress.total) * 100
                        )
                      : 0}
                    %
                  </span>
                </div>
                <div className='w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 mb-2'>
                  <div
                    className='bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300'
                    style={{
                      width: `${
                        scanProgress.total > 0
                          ? (scanProgress.current / scanProgress.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                {scanProgress.currentFolder && (
                  <p className='text-xs text-blue-700 dark:text-blue-300'>
                    正在处理: {scanProgress.currentFolder}
                  </p>
                )}
              </div>
            )}

            {refreshing ? (
              <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                加载�?..
              </div>
            ) : videos.length > 0 ? (
              <div className='overflow-x-auto'>
                <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
                  <thead className='bg-gray-50 dark:bg-gray-800'>
                    <tr>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                        标题
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                        状�?                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                        类型
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                        季度
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                        年份
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                        评分
                      </th>
                      <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className='bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700'>
                    {videos.map((video) => (
                      <tr
                        key={video.id}
                        className={
                          video.failed ? 'bg-red-50 dark:bg-red-900/10' : ''
                        }
                      >
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
                          {video.title}
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm'>
                          {video.failed ? (
                            <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'>
                              匹配失败
                            </span>
                          ) : (
                            <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'>
                              正常
                            </span>
                          )}
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400'>
                          {video.mediaType === 'movie' ? '电影' : '剧集'}
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400'>
                          {video.seasonNumber ? (
                            <span
                              className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
                              title={
                                video.seasonName || `�?{video.seasonNumber}季`
                              }
                            >
                              S{video.seasonNumber}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400'>
                          {video.releaseDate
                            ? video.releaseDate.split('-')[0]
                            : '-'}
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400'>
                          {video.voteAverage > 0
                            ? video.voteAverage.toFixed(1)
                            : '-'}
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-right text-sm'>
                          <div className='flex gap-2 justify-end'>
                            {!video.failed && (
                              <button
                                onClick={() => handleRefreshVideo(video.folder)}
                                className={buttonStyles.primarySmall}
                              >
                                刷新
                              </button>
                            )}
                            <button
                              onClick={() => {
                                console.log('Video object:', video);
                                console.log(
                                  'Video poster field:',
                                  video.poster
                                );
                                setSelectedVideo(video);
                                setCorrectDialogOpen(true);
                              }}
                              className={
                                video.failed
                                  ? buttonStyles.warningSmall
                                  : buttonStyles.successSmall
                              }
                            >
                              {video.failed ? '立即纠错' : '纠错'}
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteVideo(video.id, video.title)
                              }
                              className={buttonStyles.dangerSmall}
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                暂无视频，请点击"立即扫描"扫描视频�?              </div>
            )}
          </div>
        )}

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
        onConfirm={alertModal.onConfirm}
      />

      {/* 纠错对话�?*/}
      {selectedVideo && (
        <CorrectDialog
          isOpen={correctDialogOpen}
          onClose={() => setCorrectDialogOpen(false)}
          videoKey={selectedVideo.id}
          currentTitle={selectedVideo.title}
          currentVideo={{
            tmdbId: selectedVideo.tmdbId,
            doubanId: selectedVideo.doubanId,
            poster: selectedVideo.poster,
            releaseDate: selectedVideo.releaseDate,
            overview: selectedVideo.overview,
            voteAverage: selectedVideo.voteAverage,
            mediaType: selectedVideo.mediaType,
            seasonNumber: selectedVideo.seasonNumber,
            seasonName: selectedVideo.seasonName,
          }}
          onCorrect={handleCorrectSuccess}
        />
      )}
    </div>
  );
};

const NetDiskConfigComponent = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [enabled, setEnabled] = useState(false);
  const [cookie, setCookie] = useState('');
  const [savePath, setSavePath] = useState('/');
  const [mobileEnabled, setMobileEnabled] = useState(false);
  const [mobileAuthorization, setMobileAuthorization] = useState('');
  const [baiduEnabled, setBaiduEnabled] = useState(false);
  const [baiduCookie, setBaiduCookie] = useState('');
  const [tianyiEnabled, setTianyiEnabled] = useState(false);
  const [tianyiAccount, setTianyiAccount] = useState('');
  const [tianyiPassword, setTianyiPassword] = useState('');
  const [pan123Enabled, setPan123Enabled] = useState(false);
  const [pan123Account, setPan123Account] = useState('');
  const [pan123Password, setPan123Password] = useState('');
  const [ucEnabled, setUcEnabled] = useState(false);
  const [ucCookie, setUcCookie] = useState('');
  const [ucToken, setUcToken] = useState('');
  const [ucSavePath, setUcSavePath] = useState('/');
  const [pan115Enabled, setPan115Enabled] = useState(false);
  const [pan115Cookie, setPan115Cookie] = useState('');

  useEffect(() => {
    const quark = config?.NetDiskConfig?.Quark;
    const mobile = config?.NetDiskConfig?.Mobile;
    setEnabled(quark?.Enabled || false);
    setCookie(quark?.Cookie || '');
    setSavePath(quark?.SavePath || '/');
    setMobileEnabled(mobile?.Enabled || false);
    setMobileAuthorization(mobile?.Authorization || '');
    setBaiduEnabled(config?.NetDiskConfig?.Baidu?.Enabled || false);
    setBaiduCookie(config?.NetDiskConfig?.Baidu?.Cookie || '');
    setTianyiEnabled(config?.NetDiskConfig?.Tianyi?.Enabled || false);
    setTianyiAccount(config?.NetDiskConfig?.Tianyi?.Account || '');
    setTianyiPassword(config?.NetDiskConfig?.Tianyi?.Password || '');
    setPan123Enabled(config?.NetDiskConfig?.Pan123?.Enabled || false);
    setPan123Account(config?.NetDiskConfig?.Pan123?.Account || '');
    setPan123Password(config?.NetDiskConfig?.Pan123?.Password || '');
    setUcEnabled(config?.NetDiskConfig?.UC?.Enabled || false);
    setUcCookie(config?.NetDiskConfig?.UC?.Cookie || '');
    setUcToken(config?.NetDiskConfig?.UC?.Token || '');
    setUcSavePath(config?.NetDiskConfig?.UC?.SavePath || '/');
    setPan115Enabled(config?.NetDiskConfig?.Pan115?.Enabled || false);
    setPan115Cookie(config?.NetDiskConfig?.Pan115?.Cookie || '');
  }, [config]);

  const handleSave = async () => {
    await withLoading('saveNetDisk', async () => {
      const response = await fetch('/api/admin/netdisk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          Quark: {
            Enabled: enabled,
            Cookie: cookie,
            SavePath: savePath,
          },
          Mobile: {
            Enabled: mobileEnabled,
            Authorization: mobileAuthorization,
          },
          Baidu: {
            Enabled: baiduEnabled,
            Cookie: baiduCookie,
          },
          Tianyi: {
            Enabled: tianyiEnabled,
            Account: tianyiAccount,
            Password: tianyiPassword,
          },
          Pan123: {
            Enabled: pan123Enabled,
            Account: pan123Account,
            Password: pan123Password,
          },
          UC: {
            Enabled: ucEnabled,
            Cookie: ucCookie,
            Token: ucToken,
            SavePath: ucSavePath,
          },
          Pan115: {
            Enabled: pan115Enabled,
            Cookie: pan115Cookie,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '保存失败');
      }

      showSuccess('保存成功', showAlert);
      await refreshConfig();
    });
  };

  const handleValidate = async () => {
    await withLoading('validateNetDisk', async () => {
      try {
        const response = await fetch('/api/admin/netdisk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'validate',
            Quark: {
              Cookie: cookie,
              SavePath: savePath,
            },
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '校验失败');
        }

        showSuccess(data.message || '夸克 Cookie 可读', showAlert);
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '校验失败',
          showAlert
        );
        throw error;
      }
    });
  };

  const handleValidateMobile = async () => {
    await withLoading('validateMobileNetDisk', async () => {
      try {
        const response = await fetch('/api/admin/netdisk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'validate',
            provider: 'mobile',
            Mobile: {
              Authorization: mobileAuthorization,
            },
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '校验失败');
        }

        showSuccess(data.message || '移动云盘验证头格式正�?, showAlert);
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '校验失败',
          showAlert
        );
        throw error;
      }
    });
  };

  const handleValidateBaidu = async () => {
    await withLoading('validateBaiduNetDisk', async () => {
      try {
        const response = await fetch('/api/admin/netdisk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'validate',
            provider: 'baidu',
            Baidu: {
              Cookie: baiduCookie,
            },
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '校验失败');
        }

        showSuccess(data.message || '百度网盘 Cookie 格式正常', showAlert);
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '校验失败',
          showAlert
        );
        throw error;
      }
    });
  };

  const handleValidateTianyi = async () => {
    await withLoading('validateTianyiNetDisk', async () => {
      try {
        const response = await fetch('/api/admin/netdisk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'validate',
            provider: 'tianyi',
            Tianyi: {
              Account: tianyiAccount,
              Password: tianyiPassword,
            },
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '校验失败');
        }

        showSuccess(data.message || '天翼云盘账号密码可用', showAlert);
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '校验失败',
          showAlert
        );
        throw error;
      }
    });
  };

  const handleValidatePan123 = async () => {
    await withLoading('validatePan123NetDisk', async () => {
      try {
        const response = await fetch('/api/admin/netdisk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'validate',
            provider: 'pan123',
            Pan123: {
              Account: pan123Account,
              Password: pan123Password,
            },
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '校验失败');
        }

        showSuccess(data.message || '123网盘账号密码可用', showAlert);
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '校验失败',
          showAlert
        );
        throw error;
      }
    });
  };

  const handleValidateUC = async () => {
    await withLoading('validateUCNetDisk', async () => {
      try {
        const response = await fetch('/api/admin/netdisk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'validate',
            provider: 'uc',
            UC: {
              Cookie: ucCookie,
              Token: ucToken,
              SavePath: ucSavePath,
            },
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '校验失败');
        }

        showSuccess(data.message || 'UC Cookie 可读', showAlert);
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '校验失败',
          showAlert
        );
        throw error;
      }
    });
  };

  const handleValidatePan115 = async () => {
    await withLoading('validatePan115NetDisk', async () => {
      try {
        const response = await fetch('/api/admin/netdisk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'validate',
            provider: 'pan115',
            Pan115: {
              Cookie: pan115Cookie,
            },
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '校验失败');
        }

        showSuccess(data.message || '115 Cookie 格式正常', showAlert);
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '校验失败',
          showAlert
        );
        throw error;
      }
    });
  };

  return (
    <div className='space-y-6'>
      <details className='pt-4 border-t border-gray-200 dark:border-gray-700'>
        <summary className='text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer'>
          夸克网盘
        </summary>
        <div className='mt-4 space-y-4'>
          <div className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
            <div>
              <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                启用夸克网盘
              </h3>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                开启后，网盘搜索中的夸克资源会显示“立即播放”和“转存”按�?              </p>
            </div>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className='sr-only peer'
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              Cookie
            </label>
            <textarea
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
              disabled={!enabled}
              rows={5}
              placeholder='粘贴夸克网盘 Cookie'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              转存位置
            </label>
            <input
              type='text'
              value={savePath}
              onChange={(e) => setSavePath(e.target.value)}
              disabled={!enabled}
              placeholder='/影视/正式转存'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
            />
          </div>

          <div className='flex gap-3'>
            <button
              onClick={handleValidate}
              disabled={!enabled || !cookie || isLoading('validateNetDisk')}
              className={buttonStyles.primary}
            >
              {isLoading('validateNetDisk') ? '校验�?..' : '校验夸克配置'}
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading('saveNetDisk')}
              className={buttonStyles.success}
            >
              {isLoading('saveNetDisk') ? '保存�?..' : '保存配置'}
            </button>
          </div>
        </div>
      </details>

      <details className='pt-4 border-t border-gray-200 dark:border-gray-700'>
        <summary className='text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer'>
          移动云盘
        </summary>
        <div className='mt-4 space-y-4'>
          <div className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
            <div>
              <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                启用移动云盘
              </h3>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                开启后，网盘搜索中的移动云盘资源会显示“立即播放”按�?              </p>
            </div>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={mobileEnabled}
                onChange={(e) => setMobileEnabled(e.target.checked)}
                className='sr-only peer'
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 dark:peer-focus:ring-pink-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-pink-600"></div>
            </label>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              验证�?            </label>
            <textarea
              value={mobileAuthorization}
              onChange={(e) => setMobileAuthorization(e.target.value)}
              disabled={!mobileEnabled}
              rows={5}
              placeholder='粘贴移动云盘验证�?
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-pink-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
            />
          </div>

          <div className='flex gap-3'>
            <button
              onClick={handleValidateMobile}
              disabled={
                !mobileEnabled ||
                !mobileAuthorization ||
                isLoading('validateMobileNetDisk')
              }
              className={buttonStyles.primary}
            >
              {isLoading('validateMobileNetDisk')
                ? '校验�?..'
                : '校验移动云盘验证�?}
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading('saveNetDisk')}
              className={buttonStyles.success}
            >
              {isLoading('saveNetDisk') ? '保存�?..' : '保存配置'}
            </button>
          </div>
        </div>
      </details>

      <details className='pt-4 border-t border-gray-200 dark:border-gray-700'>
        <summary className='text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer'>
          百度网盘
        </summary>
        <div className='mt-4 space-y-4'>
          <div className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
            <div>
              <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                启用百度网盘
              </h3>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                开启后，网盘搜索中的百度网盘资源会显示“立即播放”按�?              </p>
            </div>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={baiduEnabled}
                onChange={(e) => setBaiduEnabled(e.target.checked)}
                className='sr-only peer'
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-300 dark:peer-focus:ring-sky-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-sky-600"></div>
            </label>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              Cookie
            </label>
            <textarea
              value={baiduCookie}
              onChange={(e) => setBaiduCookie(e.target.value)}
              disabled={!baiduEnabled}
              rows={5}
              placeholder='粘贴百度网盘 Cookie'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
            />
          </div>

          <div className='flex gap-3'>
            <button
              onClick={handleValidateBaidu}
              disabled={
                !baiduEnabled ||
                !baiduCookie ||
                isLoading('validateBaiduNetDisk')
              }
              className={buttonStyles.primary}
            >
              {isLoading('validateBaiduNetDisk')
                ? '校验�?..'
                : '校验百度网盘 Cookie'}
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading('saveNetDisk')}
              className={buttonStyles.success}
            >
              {isLoading('saveNetDisk') ? '保存�?..' : '保存配置'}
            </button>
          </div>
        </div>
      </details>

      <details className='pt-4 border-t border-gray-200 dark:border-gray-700'>
        <summary className='text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer'>
          天翼云盘
        </summary>
        <div className='mt-4 space-y-4'>
          <div className='rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'>
            使用天翼云盘前，请先关闭账号的设备锁，否则可能无法登录�?          </div>

          <div className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
            <div>
              <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                启用天翼云盘
              </h3>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                开启后，网盘搜索中的天翼云盘资源会显示“立即播放”按�?              </p>
            </div>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={tianyiEnabled}
                onChange={(e) => setTianyiEnabled(e.target.checked)}
                className='sr-only peer'
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
            </label>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              账号
            </label>
            <input
              type='text'
              value={tianyiAccount}
              onChange={(e) => setTianyiAccount(e.target.value)}
              disabled={!tianyiEnabled}
              placeholder='手机�?/ 邮箱 / 天翼账号'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              密码
            </label>
            <input
              type='password'
              value={tianyiPassword}
              onChange={(e) => setTianyiPassword(e.target.value)}
              disabled={!tianyiEnabled}
              placeholder='输入天翼云盘密码'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
            />
          </div>

          <div className='flex gap-3'>
            <button
              onClick={handleValidateTianyi}
              disabled={
                !tianyiEnabled ||
                !tianyiAccount ||
                !tianyiPassword ||
                isLoading('validateTianyiNetDisk')
              }
              className={buttonStyles.primary}
            >
              {isLoading('validateTianyiNetDisk')
                ? '校验�?..'
                : '校验天翼云盘账号密码'}
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading('saveNetDisk')}
              className={buttonStyles.success}
            >
              {isLoading('saveNetDisk') ? '保存�?..' : '保存配置'}
            </button>
          </div>
        </div>
      </details>

      <details className='pt-4 border-t border-gray-200 dark:border-gray-700'>
        <summary className='text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer'>
          123网盘
        </summary>
        <div className='mt-4 space-y-4'>
          <div className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
            <div>
              <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                启用123网盘
              </h3>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                开启后，网盘搜索中�?23网盘资源会显示“立即播放”按�?              </p>
            </div>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={pan123Enabled}
                onChange={(e) => setPan123Enabled(e.target.checked)}
                className='sr-only peer'
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
            </label>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              账号
            </label>
            <input
              type='text'
              value={pan123Account}
              onChange={(e) => setPan123Account(e.target.value)}
              disabled={!pan123Enabled}
              placeholder='输入123网盘账号'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              密码
            </label>
            <input
              type='password'
              value={pan123Password}
              onChange={(e) => setPan123Password(e.target.value)}
              disabled={!pan123Enabled}
              placeholder='输入123网盘密码'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
            />
          </div>

          <div className='flex gap-3'>
            <button
              onClick={handleValidatePan123}
              disabled={
                !pan123Enabled ||
                !pan123Account ||
                !pan123Password ||
                isLoading('validatePan123NetDisk')
              }
              className={buttonStyles.primary}
            >
              {isLoading('validatePan123NetDisk')
                ? '校验�?..'
                : '校验123网盘账号密码'}
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading('saveNetDisk')}
              className={buttonStyles.success}
            >
              {isLoading('saveNetDisk') ? '保存�?..' : '保存配置'}
            </button>
          </div>
        </div>
      </details>

      <details className='pt-4 border-t border-gray-200 dark:border-gray-700'>
        <summary className='text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer'>
          UC网盘
        </summary>
        <div className='mt-4 space-y-4'>
          <div className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
            <div>
              <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                启用UC网盘
              </h3>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                开启后，网盘搜索中的UC网盘资源会显示“立即播放”按�?              </p>
            </div>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={ucEnabled}
                onChange={(e) => setUcEnabled(e.target.checked)}
                className='sr-only peer'
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
            </label>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              Cookie
            </label>
            <textarea
              value={ucCookie}
              onChange={(e) => setUcCookie(e.target.value)}
              disabled={!ucEnabled}
              rows={5}
              placeholder='粘贴 UC 网盘 Cookie'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              Open API Token（可选）
            </label>
            <input
              type='text'
              value={ucToken}
              onChange={(e) => setUcToken(e.target.value)}
              disabled={!ucEnabled}
              placeholder='可选，填写后优先尝试原画地址'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              临时转存位置
            </label>
            <input
              type='text'
              value={ucSavePath}
              onChange={(e) => setUcSavePath(e.target.value)}
              disabled={!ucEnabled}
              placeholder='/影视/UC临时转存'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
            />
          </div>

          <div className='flex gap-3'>
            <button
              onClick={handleValidateUC}
              disabled={
                !ucEnabled || !ucCookie || isLoading('validateUCNetDisk')
              }
              className={buttonStyles.primary}
            >
              {isLoading('validateUCNetDisk') ? '校验�?..' : '校验UC配置'}
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading('saveNetDisk')}
              className={buttonStyles.success}
            >
              {isLoading('saveNetDisk') ? '保存�?..' : '保存配置'}
            </button>
          </div>
        </div>
      </details>

      <details className='pt-4 border-t border-gray-200 dark:border-gray-700'>
        <summary className='text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer'>
          115网盘
        </summary>
        <div className='mt-4 space-y-4'>
          <div className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
            <div>
              <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                启用115网盘
              </h3>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                开启后，网盘搜索中�?15网盘资源会显示“立即播放”按�?              </p>
            </div>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={pan115Enabled}
                onChange={(e) => setPan115Enabled(e.target.checked)}
                className='sr-only peer'
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-600"></div>
            </label>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              Cookie
            </label>
            <textarea
              value={pan115Cookie}
              onChange={(e) => setPan115Cookie(e.target.value)}
              disabled={!pan115Enabled}
              rows={5}
              placeholder='粘贴115网盘 Cookie'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
            />
          </div>

          <div className='flex gap-3'>
            <button
              onClick={handleValidatePan115}
              disabled={
                !pan115Enabled ||
                !pan115Cookie ||
                isLoading('validatePan115NetDisk')
              }
              className={buttonStyles.primary}
            >
              {isLoading('validatePan115NetDisk')
                ? '校验�?..'
                : '校验115 Cookie'}
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading('saveNetDisk')}
              className={buttonStyles.success}
            >
              {isLoading('saveNetDisk') ? '保存�?..' : '保存配置'}
            </button>
          </div>
        </div>
      </details>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
        onConfirm={alertModal.onConfirm}
      />
    </div>
  );
};

// Emby 媒体库配置组�?- 多源管理版本
const EmbyConfigComponent = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();

  // 源列表状�?  const [sources, setSources] = useState<any[]>([]);
  const [editingSource, setEditingSource] = useState<any | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set()
  );

  // 表单状�?  const [formData, setFormData] = useState({
    key: '',
    name: '',
    enabled: true,
    ServerURL: '',
    ApiKey: '',
    Username: '',
    Password: '',
    UserId: '',
    isDefault: false,
    // 高级选项
    removeEmbyPrefix: false,
    appendMediaSourceId: false,
    transcodeMp4: false,
    proxyPlay: false,
    customUserAgent: '',
  });
  const [authMode, setAuthMode] = useState<'apikey' | 'password'>('apikey');

  // 从配置加载源列表
  useEffect(() => {
    if (config?.EmbyConfig?.Sources) {
      setSources(config.EmbyConfig.Sources);
    } else if (config?.EmbyConfig?.ServerURL) {
      // 兼容旧格�?      setSources([
        {
          key: 'default',
          name: 'Emby',
          enabled: config.EmbyConfig.Enabled || false,
          ServerURL: config.EmbyConfig.ServerURL,
          ApiKey: config.EmbyConfig.ApiKey,
          Username: config.EmbyConfig.Username,
          Password: config.EmbyConfig.Password,
          UserId: config.EmbyConfig.UserId,
          isDefault: true,
        },
      ]);
    }
  }, [config]);

  // 重置表单
  const resetForm = () => {
    setFormData({
      key: '',
      name: '',
      enabled: true,
      ServerURL: '',
      ApiKey: '',
      Username: '',
      Password: '',
      UserId: '',
      isDefault: false,
      // 高级选项
      removeEmbyPrefix: false,
      appendMediaSourceId: false,
      transcodeMp4: false,
      proxyPlay: false,
      customUserAgent: '',
    });
    setAuthMode('apikey');
    setEditingSource(null);
    setShowAddForm(false);
  };

  // 开始编�?  const handleEdit = (source: any) => {
    setFormData({ ...source });
    // 根据现有配置判断认证方式
    if (source.ApiKey) {
      setAuthMode('apikey');
    } else if (source.Username) {
      setAuthMode('password');
    } else {
      setAuthMode('apikey');
    }
    setEditingSource(source);
    setShowAddForm(false);
  };

  // 开始添�?  const handleAdd = () => {
    resetForm();
    setShowAddForm(true);
  };

  // 保存源（添加或更新）
  const handleSave = async () => {
    // 验证必填字段
    if (!formData.key || !formData.name || !formData.ServerURL) {
      showError('请填写必填字段：标识符、名称、服务器地址', showAlert);
      return;
    }

    // 根据认证方式验证必填字段
    if (authMode === 'apikey') {
      if (!formData.ApiKey || !formData.UserId) {
        showError('使用密钥认证时，API Key 和用�?ID 为必填项', showAlert);
        return;
      }
    } else if (authMode === 'password') {
      if (!formData.Username) {
        showError('使用账号认证时，用户名为必填�?, showAlert);
        return;
      }
    }

    // 验证key唯一�?    if (!editingSource && sources.some((s) => s.key === formData.key)) {
      showError('标识符已存在，请使用其他标识�?, showAlert);
      return;
    }

    await withLoading('saveEmbySource', async () => {
      try {
        let newSources;
        if (editingSource) {
          // 更新现有�?          newSources = sources.map((s) =>
            s.key === editingSource.key ? formData : s
          );
        } else {
          // 添加新源
          newSources = [...sources, formData];
        }

        // 保存到配�?        const response = await fetch('/api/admin/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...config,
            EmbyConfig: {
              Sources: newSources,
            },
          }),
        });

        if (!response.ok) {
          throw new Error('保存失败');
        }

        await refreshConfig();
        resetForm();
        showSuccess(editingSource ? '更新成功' : '添加成功', showAlert);
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '保存失败',
          showAlert
        );
      }
    });
  };

  // 删除�?  const handleDelete = async (source: any) => {
    if (!confirm(`确定要删�?"${source.name}" 吗？`)) {
      return;
    }

    await withLoading('deleteEmbySource', async () => {
      try {
        const newSources = sources.filter((s) => s.key !== source.key);

        const response = await fetch('/api/admin/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...config,
            EmbyConfig: {
              Sources: newSources,
            },
          }),
        });

        if (!response.ok) {
          throw new Error('删除失败');
        }

        await refreshConfig();
        showSuccess('删除成功', showAlert);
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '删除失败',
          showAlert
        );
      }
    });
  };

  // 切换启用状�?  const handleToggleEnabled = async (source: any) => {
    await withLoading('toggleEmbySource', async () => {
      try {
        const newSources = sources.map((s) =>
          s.key === source.key ? { ...s, enabled: !s.enabled } : s
        );

        const response = await fetch('/api/admin/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...config,
            EmbyConfig: {
              Sources: newSources,
            },
          }),
        });

        if (!response.ok) {
          throw new Error('更新失败');
        }

        await refreshConfig();
        showSuccess(source.enabled ? '已禁�? : '已启�?, showAlert);
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '更新失败',
          showAlert
        );
      }
    });
  };

  // 测试连接
  const handleTest = async (source: any) => {
    await withLoading('testEmbySource', async () => {
      try {
        const response = await fetch('/api/admin/emby', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'test',
            ServerURL: source.ServerURL,
            ApiKey: source.ApiKey,
            Username: source.Username,
            Password: source.Password,
          }),
        });

        const data = await response.json();

        if (data.success) {
          showSuccess(data.message || 'Emby 连接测试成功', showAlert);
        } else {
          showError(data.message || 'Emby 连接测试失败', showAlert);
        }
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '测试失败',
          showAlert
        );
      }
    });
  };

  // 清除缓存
  const handleClearCache = async () => {
    await withLoading('clearEmbyCache', async () => {
      try {
        const response = await fetch('/api/admin/emby', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'clearCache',
          }),
        });

        const data = await response.json();

        if (data.success) {
          showSuccess(data.message || '缓存清除成功', showAlert);
        } else {
          showError(data.message || '缓存清除失败', showAlert);
        }
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '缓存清除失败',
          showAlert
        );
      }
    });
  };

  // 导出配置
  const handleExport = async () => {
    await withLoading('exportEmby', async () => {
      try {
        const response = await fetch('/api/admin/emby/export');
        if (!response.ok) {
          const data = await response.json();
          showError(data.error || '导出失败', showAlert);
          return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `emby-config-${Date.now()}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        showSuccess('导出成功', showAlert);
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '导出失败',
          showAlert
        );
      }
    });
  };

  // 导入配置
  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      await withLoading('importEmby', async () => {
        try {
          const text = await file.text();
          const data = JSON.parse(text);

          const response = await fetch('/api/admin/emby/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data }),
          });

          const result = await response.json();

          if (result.success) {
            showSuccess('导入成功', showAlert);
            await refreshConfig();
          } else {
            showError(result.error || '导入失败', showAlert);
          }
        } catch (error) {
          showError(
            error instanceof Error ? error.message : '导入失败',
            showAlert
          );
        }
      });
    };
    input.click();
  };

  // 批量启用
  const handleBatchEnable = async () => {
    if (selectedSources.size === 0) return;
    await withLoading('batchEnableEmby', async () => {
      try {
        const newSources = sources.map((s) =>
          selectedSources.has(s.key) ? { ...s, enabled: true } : s
        );
        const response = await fetch('/api/admin/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...config,
            EmbyConfig: { Sources: newSources },
          }),
        });
        if (!response.ok) throw new Error('批量启用失败');
        await refreshConfig();
        setSelectedSources(new Set());
        showSuccess(`已启�?${selectedSources.size} 个源`, showAlert);
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '批量启用失败',
          showAlert
        );
      }
    });
  };

  // 批量禁用
  const handleBatchDisable = async () => {
    if (selectedSources.size === 0) return;
    await withLoading('batchDisableEmby', async () => {
      try {
        const newSources = sources.map((s) =>
          selectedSources.has(s.key) ? { ...s, enabled: false } : s
        );
        const response = await fetch('/api/admin/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...config,
            EmbyConfig: { Sources: newSources },
          }),
        });
        if (!response.ok) throw new Error('批量禁用失败');
        await refreshConfig();
        setSelectedSources(new Set());
        showSuccess(`已禁�?${selectedSources.size} 个源`, showAlert);
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '批量禁用失败',
          showAlert
        );
      }
    });
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedSources.size === 0) return;
    showAlert({
      type: 'warning',
      title: '确认批量删除',
      message: `确定要删除选中�?${selectedSources.size} 个源吗？此操作不可恢复。`,
      showConfirm: true,
      onConfirm: async () => {
        await withLoading('batchDeleteEmby', async () => {
          try {
            const newSources = sources.filter(
              (s) => !selectedSources.has(s.key)
            );
            const response = await fetch('/api/admin/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...config,
                EmbyConfig: { Sources: newSources },
              }),
            });
            if (!response.ok) throw new Error('批量删除失败');
            await refreshConfig();
            setSelectedSources(new Set());
            showSuccess(`已删�?${selectedSources.size} 个源`, showAlert);
          } catch (error) {
            showError(
              error instanceof Error ? error.message : '批量删除失败',
              showAlert
            );
          }
        });
      },
    });
  };

  return (
    <div className='space-y-6'>
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
        onConfirm={alertModal.onConfirm}
      />

      {/* 源列�?*/}
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100'>
            Emby 源列�?({sources.length})
          </h3>
          <div className='flex gap-2'>
            <button onClick={handleAdd} className={buttonStyles.success}>
              添加新源
            </button>
          </div>
        </div>

        {selectedSources.size > 0 && (
          <div className='flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg'>
            <span className='text-sm text-gray-700 dark:text-gray-300'>
              已选择 {selectedSources.size} �?            </span>
            <button
              onClick={handleBatchEnable}
              disabled={isLoading('batchEnableEmby')}
              className={buttonStyles.successSmall}
            >
              批量启用
            </button>
            <button
              onClick={handleBatchDisable}
              disabled={isLoading('batchDisableEmby')}
              className={buttonStyles.warningSmall}
            >
              批量禁用
            </button>
            <button
              onClick={handleBatchDelete}
              disabled={isLoading('batchDeleteEmby')}
              className={buttonStyles.dangerSmall}
            >
              批量删除
            </button>
            <button
              onClick={() => setSelectedSources(new Set())}
              className={buttonStyles.secondarySmall}
            >
              取消选择
            </button>
          </div>
        )}

        {sources.length === 0 ? (
          <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
            暂无Emby源，点击"添加新源"开始配�?          </div>
        ) : (
          sources.map((source) => (
            <div
              key={source.key}
              className='border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800'
            >
              <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3'>
                <div className='flex items-center gap-3 flex-1'>
                  <input
                    type='checkbox'
                    checked={selectedSources.has(source.key)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedSources);
                      if (e.target.checked) {
                        newSelected.add(source.key);
                      } else {
                        newSelected.delete(source.key);
                      }
                      setSelectedSources(newSelected);
                    }}
                    className='w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600'
                  />
                  <div className='flex-1'>
                    <div className='flex items-center gap-3 flex-wrap'>
                      <h4 className='text-base font-medium text-gray-900 dark:text-gray-100'>
                        {source.name}
                      </h4>
                      {source.isDefault && (
                        <span className='px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 rounded'>
                          默认
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                          source.enabled
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {source.enabled ? '已启�? : '已禁�?}
                      </span>
                    </div>
                    <p className='mt-1 text-sm text-gray-600 dark:text-gray-400'>
                      标识�? {source.key}
                    </p>
                    <p className='mt-1 text-sm text-gray-600 dark:text-gray-400'>
                      服务�? {source.ServerURL}
                    </p>
                    {source.UserId && (
                      <p className='mt-1 text-sm text-gray-600 dark:text-gray-400'>
                        用户ID: {source.UserId}
                      </p>
                    )}
                  </div>
                </div>
                <div className='flex gap-2 flex-wrap sm:flex-nowrap'>
                  <button
                    onClick={() => handleToggleEnabled(source)}
                    disabled={isLoading('toggleEmbySource')}
                    className={
                      source.enabled
                        ? buttonStyles.warningSmall
                        : buttonStyles.successSmall
                    }
                  >
                    {source.enabled ? '禁用' : '启用'}
                  </button>
                  <button
                    onClick={() => handleTest(source)}
                    disabled={isLoading('testEmbySource')}
                    className={buttonStyles.primarySmall}
                  >
                    测试
                  </button>
                  <button
                    onClick={() => handleEdit(source)}
                    className={buttonStyles.primarySmall}
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(source)}
                    disabled={isLoading('deleteEmbySource')}
                    className={buttonStyles.dangerSmall}
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 添加/编辑表单 */}
      {(showAddForm || editingSource) && (
        <div className='border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-gray-50 dark:bg-gray-800/50'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-4'>
            {editingSource ? '编辑 Emby �? : '添加新的 Emby �?}
          </h3>

          <div className='space-y-4'>
            {/* 标识�?*/}
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                标识�?*
              </label>
              <input
                type='text'
                value={formData.key}
                onChange={(e) =>
                  setFormData({ ...formData, key: e.target.value })
                }
                disabled={!!editingSource}
                placeholder='home, office, etc.'
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-700'
              />
              <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                唯一标识符，只能包含字母、数字、下划线，创建后不可修改
              </p>
            </div>

            {/* 名称 */}
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                显示名称 *
              </label>
              <input
                type='text'
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder='家庭Emby, 公司Emby, etc.'
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>

            {/* 服务器地址 */}
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                Emby 服务器地址 *
              </label>
              <input
                type='text'
                value={formData.ServerURL}
                onChange={(e) =>
                  setFormData({ ...formData, ServerURL: e.target.value })
                }
                placeholder='http://192.168.1.100:8096'
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>

            {/* 认证方式切换�?*/}
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                认证方式 *
              </label>
              <div className='flex gap-2 mb-4'>
                <button
                  type='button'
                  onClick={() => {
                    setAuthMode('apikey');
                    // 切换到密钥认证时，清空用户名密码
                    setFormData({ ...formData, Username: '', Password: '' });
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    authMode === 'apikey'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  密钥认证
                </button>
                <button
                  type='button'
                  onClick={() => {
                    setAuthMode('password');
                    // 切换到账号认证时，清�?API Key �?UserId
                    setFormData({ ...formData, ApiKey: '', UserId: '' });
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    authMode === 'password'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  账号认证
                </button>
              </div>
            </div>

            {/* 密钥认证模式 */}
            {authMode === 'apikey' && (
              <>
                {/* API Key */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    API Key *
                  </label>
                  <input
                    type='password'
                    value={formData.ApiKey}
                    onChange={(e) =>
                      setFormData({ ...formData, ApiKey: e.target.value })
                    }
                    placeholder='输入 Emby API Key'
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  />
                  <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                    �?Emby 控制台的 API 密钥页面生成
                  </p>
                </div>

                {/* 用户 ID */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    用户 ID *
                  </label>
                  <input
                    type='text'
                    value={formData.UserId}
                    onChange={(e) =>
                      setFormData({ ...formData, UserId: e.target.value })
                    }
                    placeholder='aab507c58e874de6a9bd12388d72f4d2'
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  />
                  <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                    从你�?Emby 抓包数据中获取用�?ID，通常�?URL 中如
                    /Users/[userId]/...
                  </p>
                </div>
              </>
            )}

            {/* 账号认证模式 */}
            {authMode === 'password' && (
              <>
                {/* 用户�?*/}
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    用户�?*
                  </label>
                  <input
                    type='text'
                    value={formData.Username}
                    onChange={(e) =>
                      setFormData({ ...formData, Username: e.target.value })
                    }
                    placeholder='Emby 用户�?
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  />
                </div>

                {/* 密码 */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    密码（可选）
                  </label>
                  <input
                    type='password'
                    value={formData.Password}
                    onChange={(e) =>
                      setFormData({ ...formData, Password: e.target.value })
                    }
                    placeholder='Emby 密码（如果账号没有密码可留空�?
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  />
                  <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                    如果 Emby 账号没有设置密码，可以留�?                  </p>
                </div>
              </>
            )}

            {/* 启用开�?*/}
            <div className='flex items-center justify-between'>
              <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                启用此源
              </label>
              <button
                onClick={() =>
                  setFormData({ ...formData, enabled: !formData.enabled })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.enabled
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 高级选项 */}
            <div className='border-t border-gray-200 dark:border-gray-700 pt-4 mt-4'>
              <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
                高级选项
              </h4>

              {/* 选项1: 播放链接移除/emby前缀 */}
              <div className='flex items-center justify-between mb-3'>
                <div className='flex-1'>
                  <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    播放链接移除/emby前缀
                  </label>
                  <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                    启用后将从播放链接中移除 /emby 前缀
                  </p>
                </div>
                <button
                  onClick={() =>
                    setFormData({
                      ...formData,
                      removeEmbyPrefix: !formData.removeEmbyPrefix,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.removeEmbyPrefix
                      ? 'bg-blue-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.removeEmbyPrefix
                        ? 'translate-x-6'
                        : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* 选项2: 拼接MediaSourceId参数 */}
              <div className='flex items-center justify-between mb-3'>
                <div className='flex-1'>
                  <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    拼接MediaSourceId参数
                  </label>
                  <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                    启用后将调用 PlaybackInfo API 获取 MediaSourceId
                    并添加到播放链接
                  </p>
                </div>
                <button
                  onClick={() =>
                    setFormData({
                      ...formData,
                      appendMediaSourceId: !formData.appendMediaSourceId,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.appendMediaSourceId
                      ? 'bg-blue-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.appendMediaSourceId
                        ? 'translate-x-6'
                        : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* 选项3: 转码mp4 */}
              <div className='flex items-center justify-between mb-3'>
                <div className='flex-1'>
                  <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    转码mp4
                  </label>
                  <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                    启用后将使用 stream.mp4 格式并移�?Static 参数
                  </p>
                </div>
                <button
                  onClick={() =>
                    setFormData({
                      ...formData,
                      transcodeMp4: !formData.transcodeMp4,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.transcodeMp4
                      ? 'bg-blue-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.transcodeMp4 ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* 视频播放代理开�?*/}
              <div className='flex items-center justify-between mb-3'>
                <div className='flex-1'>
                  <h4 className='text-sm font-medium text-gray-900 dark:text-white'>
                    视频播放代理
                  </h4>
                  <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                    启用后视频播放将通过服务器代�?                  </p>
                </div>
                <button
                  onClick={() =>
                    setFormData({ ...formData, proxyPlay: !formData.proxyPlay })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.proxyPlay
                      ? 'bg-blue-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.proxyPlay ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* 自定义User-Agent */}
              <div className='mb-3'>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  自定义User-Agent
                </label>
                <input
                  type='text'
                  value={formData.customUserAgent || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      customUserAgent: e.target.value,
                    })
                  }
                  placeholder='留空使用默认浏览器UA'
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm'
                />
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  用于登录、获取影片和代理视频时的User-Agent，留空则使用默认浏览器UA
                </p>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className='flex gap-3 pt-4'>
              <button
                onClick={handleSave}
                disabled={isLoading('saveEmbySource')}
                className={buttonStyles.success}
              >
                {isLoading('saveEmbySource') ? '保存�?..' : '保存'}
              </button>
              <button onClick={resetForm} className={buttonStyles.secondary}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 全局操作 */}
      <div className='flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700'>
        <button
          onClick={handleClearCache}
          disabled={isLoading('clearEmbyCache')}
          className={buttonStyles.warning}
        >
          {isLoading('clearEmbyCache') ? '清除�?..' : '清除所有缓�?}
        </button>
        <button
          onClick={handleExport}
          disabled={isLoading('exportEmby')}
          className={buttonStyles.secondary}
        >
          {isLoading('exportEmby') ? '导出�?..' : '导出配置'}
        </button>
        <button
          onClick={handleImport}
          disabled={isLoading('importEmby')}
          className={buttonStyles.secondary}
        >
          {isLoading('importEmby') ? '导入�?..' : '导入配置'}
        </button>
      </div>
    </div>
  );
};

// 视频源配置组�?const VideoSourceConfig = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [sources, setSources] = useState<DataSource[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);
  const [newSource, setNewSource] = useState<DataSource>({
    name: '',
    key: '',
    api: '',
    detail: '',
    disabled: false,
    from: 'config',
  });

  // 批量操作相关状�?  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set()
  );

  // 使用 useMemo 计算全选状态，避免每次渲染都重新计�?  const selectAll = useMemo(() => {
    return selectedSources.size === sources.length && selectedSources.size > 0;
  }, [selectedSources.size, sources.length]);

  // 确认弹窗状�?  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  // 有效性检测相关状�?  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weightDraftSources, setWeightDraftSources] = useState<DataSource[]>(
    []
  );
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<
    Array<{
      key: string;
      name: string;
      status: 'valid' | 'no_results' | 'invalid' | 'validating';
      message: string;
      resultCount: number;
    }>
  >([]);

  // dnd-kit 传感�?  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 轻微位移即可触发
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 长按 150ms 后触发，避免与滚动冲�?        tolerance: 5,
      },
    })
  );

  // 初始�?  useEffect(() => {
    if (config?.SourceConfig) {
      setSources(config.SourceConfig);
      // 进入时重�?orderChanged
      setOrderChanged(false);
      // 重置选择状�?      setSelectedSources(new Set());
    }
  }, [config]);

  // 通用 API 请求
  const callSourceApi = async (body: Record<string, any>) => {
    try {
      const resp = await fetch('/api/admin/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `操作失败: ${resp.status}`);
      }

      // 获取响应数据
      const data = await resp.json();

      // 成功后刷新配�?      await refreshConfig();

      // 返回响应数据供调用者使�?      return data;
    } catch (err) {
      showError(err instanceof Error ? err.message : '操作失败', showAlert);
      throw err; // 向上抛出方便调用处判�?    }
  };

  const handleToggleEnable = (key: string) => {
    const target = sources.find((s) => s.key === key);
    if (!target) return;
    const action = target.disabled ? 'enable' : 'disable';
    withLoading(`toggleSource_${key}`, () =>
      callSourceApi({ action, key })
    ).catch(() => {
      console.error('操作失败', action, key);
    });
  };

  const handleDelete = (key: string) => {
    withLoading(`deleteSource_${key}`, () =>
      callSourceApi({ action: 'delete', key })
    ).catch(() => {
      console.error('操作失败', 'delete', key);
    });
  };

  const handleToggleProxyMode = (key: string) => {
    const target = sources.find((s) => s.key === key);
    if (!target) return;

    // 更新本地状�?    setSources((prev) =>
      prev.map((s) => (s.key === key ? { ...s, proxyMode: !s.proxyMode } : s))
    );

    // 调用API更新
    withLoading(`toggleProxyMode_${key}`, async () => {
      try {
        const response = await fetch('/api/admin/source', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'toggle_proxy_mode',
            key,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `操作失败: ${response.status}`);
        }

        await refreshConfig();
      } catch (error) {
        // 失败时回滚本地状�?        setSources((prev) =>
          prev.map((s) =>
            s.key === key ? { ...s, proxyMode: !s.proxyMode } : s
          )
        );
        showError(
          error instanceof Error ? error.message : '切换代理模式失败',
          showAlert
        );
        throw error;
      }
    }).catch(() => {
      console.error('操作失败', 'toggle_proxy_mode', key);
    });
  };

  const handleUpdateWeight = (key: string, weight: number) => {
    // 先乐观更新本地状�?    setSources((prev) =>
      prev.map((s) => (s.key === key ? { ...s, weight } : s))
    );

    // 调用API更新
    withLoading(`updateWeight_${key}`, async () => {
      try {
        const response = await fetch('/api/admin/source', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_weight',
            key,
            weight,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `操作失败: ${response.status}`);
        }

        await refreshConfig();
      } catch (error) {
        // 失败时回滚本地状态到配置中的�?        const originalWeight =
          config?.SourceConfig?.find((s) => s.key === key)?.weight ?? 0;
        setSources((prev) =>
          prev.map((s) =>
            s.key === key ? { ...s, weight: originalWeight } : s
          )
        );
        showError(
          error instanceof Error ? error.message : '更新权重失败',
          showAlert
        );
        throw error;
      }
    }).catch(() => {
      console.error('操作失败', 'update_weight', key, weight);
    });
  };

  const handleAddSource = () => {
    if (!newSource.name || !newSource.key || !newSource.api) return;
    withLoading('addSource', async () => {
      await callSourceApi({
        action: 'add',
        key: newSource.key,
        name: newSource.name,
        api: newSource.api,
        detail: newSource.detail,
      });
      setNewSource({
        name: '',
        key: '',
        api: '',
        detail: '',
        disabled: false,
        from: 'custom',
      });
      setShowAddForm(false);
    }).catch(() => {
      console.error('操作失败', 'add', newSource);
    });
  };

  const buildRecommendedWeightMap = useCallback((list: DataSource[]) => {
    const total = list.length;
    return new Map(
      list.map((source, index) => {
        const recommended =
          total <= 1
            ? 40
            : Math.round(((total - index - 1) * 40) / (total - 1));
        return [source.key, recommended];
      })
    );
  }, []);

  const applyRecommendedWeights = useCallback((list: DataSource[]) => {
    const total = list.length;
    return list.map((source, index) => ({
      ...source,
      weight:
        total <= 1 ? 40 : Math.round(((total - index - 1) * 40) / (total - 1)),
    }));
  }, []);

  const openWeightModal = useCallback(() => {
    setWeightDraftSources(sources.map((source) => ({ ...source })));
    setShowWeightModal(true);
  }, [sources]);

  const handleCloseWeightModal = useCallback(() => {
    setShowWeightModal(false);
    setWeightDraftSources([]);
  }, []);

  useEffect(() => {
    if (!showWeightModal) return;

    const isInsideAllowedScroll = (target: EventTarget | null) => {
      if (!(target instanceof Node)) return false;
      return !!target.parentElement?.closest('[data-weight-modal-scroll]');
    };

    const preventBackgroundScroll = (event: TouchEvent | WheelEvent) => {
      if (isInsideAllowedScroll(event.target)) return;
      event.preventDefault();
    };

    document.addEventListener('touchmove', preventBackgroundScroll, {
      passive: false,
    });
    document.addEventListener('wheel', preventBackgroundScroll, {
      passive: false,
    });

    return () => {
      document.removeEventListener(
        'touchmove',
        preventBackgroundScroll as EventListener
      );
      document.removeEventListener(
        'wheel',
        preventBackgroundScroll as EventListener
      );
    };
  }, [showWeightModal]);

  const handleWeightDraftChange = useCallback((key: string, weight: number) => {
    setWeightDraftSources((prev) =>
      prev.map((source) =>
        source.key === key ? { ...source, weight } : source
      )
    );
  }, []);

  const handleApplyRecommendedWeights = useCallback(() => {
    setWeightDraftSources((prev) => applyRecommendedWeights(prev));
  }, [applyRecommendedWeights]);

  const handleResetWeightDraft = useCallback(() => {
    setWeightDraftSources(sources.map((source) => ({ ...source })));
  }, [sources]);

  const handleWeightModalDragEnd = useCallback(
    (event: any) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setWeightDraftSources((prev) => {
        const oldIndex = prev.findIndex((source) => source.key === active.id);
        const newIndex = prev.findIndex((source) => source.key === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return applyRecommendedWeights(arrayMove(prev, oldIndex, newIndex));
      });
    },
    [applyRecommendedWeights]
  );

  const recommendedWeightMap = useMemo(
    () => buildRecommendedWeightMap(weightDraftSources),
    [buildRecommendedWeightMap, weightDraftSources]
  );

  const weightModalChanged = useMemo(() => {
    if (weightDraftSources.length !== sources.length) return false;
    return weightDraftSources.some((source, index) => {
      const current = sources[index];
      return (
        !current ||
        current.key !== source.key ||
        (current.weight ?? 0) !== (source.weight ?? 0)
      );
    });
  }, [sources, weightDraftSources]);

  const handleSaveWeightConfig = useCallback(() => {
    withLoading('saveWeightConfig', async () => {
      await callSourceApi({
        action: 'batch_update_weights',
        weights: weightDraftSources.map((source) => ({
          key: source.key,
          weight: source.weight ?? 0,
        })),
        order: weightDraftSources.map((source) => source.key),
      });
      setSources(weightDraftSources.map((source) => ({ ...source })));
      setOrderChanged(false);
      handleCloseWeightModal();
    }).catch(() => {
      console.error('操作失败', 'batch_update_weights');
    });
  }, [callSourceApi, handleCloseWeightModal, weightDraftSources, withLoading]);

  // 有效性检测函�?  const handleValidateSources = async () => {
    if (!searchKeyword.trim()) {
      showAlert({
        type: 'warning',
        title: '请输入搜索关键词',
        message: '搜索关键词不能为�?,
      });
      return;
    }

    await withLoading('validateSources', async () => {
      setIsValidating(true);
      setValidationResults([]); // 清空之前的结�?      setShowValidationModal(false); // 立即关闭弹窗

      // 初始化所有视频源为检测中状�?      const initialResults = sources.map((source) => ({
        key: source.key,
        name: source.name,
        status: 'validating' as const,
        message: '检测中...',
        resultCount: 0,
      }));
      setValidationResults(initialResults);

      try {
        // 使用EventSource接收流式数据
        const eventSource = new EventSource(
          `/api/admin/source/validate?q=${encodeURIComponent(
            searchKeyword.trim()
          )}`
        );

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            switch (data.type) {
              case 'start':
                console.log(`开始检�?${data.totalSources} 个视频源`);
                break;

              case 'source_result':
              case 'source_error':
                // 更新验证结果
                setValidationResults((prev) => {
                  const existing = prev.find((r) => r.key === data.source);
                  if (existing) {
                    return prev.map((r) =>
                      r.key === data.source
                        ? {
                            key: data.source,
                            name:
                              sources.find((s) => s.key === data.source)
                                ?.name || data.source,
                            status: data.status,
                            message:
                              data.status === 'valid'
                                ? '搜索正常'
                                : data.status === 'no_results'
                                ? '无法搜索到结�?
                                : '连接失败',
                            resultCount: data.status === 'valid' ? 1 : 0,
                          }
                        : r
                    );
                  } else {
                    return [
                      ...prev,
                      {
                        key: data.source,
                        name:
                          sources.find((s) => s.key === data.source)?.name ||
                          data.source,
                        status: data.status,
                        message:
                          data.status === 'valid'
                            ? '搜索正常'
                            : data.status === 'no_results'
                            ? '无法搜索到结�?
                            : '连接失败',
                        resultCount: data.status === 'valid' ? 1 : 0,
                      },
                    ];
                  }
                });
                break;

              case 'complete':
                console.log(
                  `检测完成，共检�?${data.completedSources} 个视频源`
                );
                eventSource.close();
                setIsValidating(false);
                break;
            }
          } catch (error) {
            console.error('解析EventSource数据失败:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('EventSource错误:', error);
          eventSource.close();
          setIsValidating(false);
          showAlert({
            type: 'error',
            title: '验证失败',
            message: '连接错误，请重试',
          });
        };

        // 设置超时，防止长时间等待
        setTimeout(() => {
          if (eventSource.readyState === EventSource.OPEN) {
            eventSource.close();
            setIsValidating(false);
            showAlert({
              type: 'warning',
              title: '验证超时',
              message: '检测超时，请重�?,
            });
          }
        }, 60000); // 60秒超�?      } catch (error) {
        setIsValidating(false);
        showAlert({
          type: 'error',
          title: '验证失败',
          message: error instanceof Error ? error.message : '未知错误',
        });
        throw error;
      }
    });
  };

  // 获取有效性状态显�?  const getValidationStatus = (sourceKey: string) => {
    const result = validationResults.find((r) => r.key === sourceKey);
    if (!result) return null;

    switch (result.status) {
      case 'validating':
        return {
          text: '检测中',
          className:
            'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300',
          icon: '�?,
          message: result.message,
        };
      case 'valid':
        return {
          text: '有效',
          className:
            'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300',
          icon: '�?,
          message: result.message,
        };
      case 'no_results':
        return {
          text: '无法搜索',
          className:
            'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300',
          icon: '�?,
          message: result.message,
        };
      case 'invalid':
        return {
          text: '无效',
          className:
            'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300',
          icon: '�?,
          message: result.message,
        };
      default:
        return null;
    }
  };

  const WeightModalInput = memo(
    ({ sourceKey, weight }: { sourceKey: string; weight: number }) => {
      const [localWeight, setLocalWeight] = useState(weight);

      useEffect(() => {
        setLocalWeight(weight);
      }, [weight]);

      const commitWeight = (value: number) => {
        const clampedValue = Math.min(100, Math.max(0, value));
        setLocalWeight(clampedValue);
        handleWeightDraftChange(sourceKey, clampedValue);
      };

      return (
        <div
          className='flex items-center gap-3'
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <input
            type='range'
            min='0'
            max='100'
            value={localWeight}
            onChange={(e) => commitWeight(parseInt(e.target.value) || 0)}
            className='w-full accent-blue-600'
          />
          <input
            type='number'
            inputMode='numeric'
            min='0'
            max='100'
            value={localWeight}
            onChange={(e) => {
              const nextValue = parseInt(e.target.value) || 0;
              const clampedValue = Math.min(100, Math.max(0, nextValue));
              setLocalWeight(clampedValue);
            }}
            onBlur={(e) => commitWeight(parseInt(e.target.value) || 0)}
            className='w-20 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          />
        </div>
      );
    }
  );

  const WeightModalRow = memo(
    ({
      source,
      index,
      recommendedWeight,
    }: {
      source: DataSource;
      index: number;
      recommendedWeight: number;
    }) => {
      const { attributes, listeners, setNodeRef, transform, transition } =
        useSortable({ id: source.key });

      const style = {
        transform: CSS.Transform.toString(transform),
        transition,
      } as React.CSSProperties;

      return (
        <div
          ref={setNodeRef}
          style={style}
          className='grid grid-cols-[88px_minmax(0,1fr)_112px_112px_220px] items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition hover:border-blue-200 hover:shadow dark:border-gray-700 dark:bg-gray-800/90 dark:hover:border-blue-800'
        >
          <div
            className='flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 cursor-grab'
            style={{ touchAction: 'none' }}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} />
            <span className='font-medium text-gray-700 dark:text-gray-200'>
              #{index + 1}
            </span>
          </div>
          <div className='min-w-0'>
            <div className='truncate text-sm font-medium text-gray-900 dark:text-gray-100'>
              {source.name}
            </div>
            <div className='truncate text-xs text-gray-500 dark:text-gray-400'>
              {source.key}
            </div>
          </div>
          <div>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                source.disabled
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              }`}
            >
              {source.disabled ? '已禁�? : '启用�?}
            </span>
          </div>
          <div>
            <span className='inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'>
              {recommendedWeight}
            </span>
          </div>
          <WeightModalInput
            sourceKey={source.key}
            weight={source.weight ?? 0}
          />
        </div>
      );
    }
  );

  const SourceRow = memo(({ source }: { source: DataSource }) => {
    return (
      <tr className='hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'>
        <td className='px-2 py-4 text-center'>
          <input
            type='checkbox'
            checked={selectedSources.has(source.key)}
            onChange={(e) => handleSelectSource(source.key, e.target.checked)}
            className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
          />
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
          {source.name}
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
          {source.key}
        </td>
        <td
          className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 max-w-[12rem] truncate'
          title={source.api}
        >
          {source.api}
        </td>
        <td
          className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 max-w-[8rem] truncate'
          title={source.detail || '-'}
        >
          {source.detail || '-'}
        </td>
        <td className='px-6 py-4 whitespace-nowrap max-w-[1rem]'>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              !source.disabled
                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
            }`}
          >
            {!source.disabled ? '启用�? : '已禁�?}
          </span>
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-center'>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleProxyMode(source.key);
            }}
            disabled={isLoading(`toggleProxyMode_${source.key}`)}
            className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors ${
              source.proxyMode
                ? 'bg-blue-600 dark:bg-blue-500'
                : 'bg-gray-200 dark:bg-gray-700'
            } ${
              isLoading(`toggleProxyMode_${source.key}`)
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer'
            }`}
            title={source.proxyMode ? '代理模式已启�? : '代理模式已禁�?}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                source.proxyMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </td>
        <td className='px-6 py-4 whitespace-nowrap max-w-[1rem]'>
          {(() => {
            const status = getValidationStatus(source.key);
            if (!status) {
              return (
                <span className='px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400'>
                  未检�?                </span>
              );
            }
            return (
              <span
                className={`px-2 py-1 text-xs rounded-full ${status.className}`}
                title={status.message}
              >
                {status.icon} {status.text}
              </span>
            );
          })()}
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
          <button
            onClick={() => handleToggleEnable(source.key)}
            disabled={isLoading(`toggleSource_${source.key}`)}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
              !source.disabled
                ? buttonStyles.roundedDanger
                : buttonStyles.roundedSuccess
            } transition-colors ${
              isLoading(`toggleSource_${source.key}`)
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            {!source.disabled ? '禁用' : '启用'}
          </button>
          {source.from !== 'config' && (
            <button
              onClick={() => handleDelete(source.key)}
              disabled={isLoading(`deleteSource_${source.key}`)}
              className={`${buttonStyles.roundedSecondary} ${
                isLoading(`deleteSource_${source.key}`)
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              删除
            </button>
          )}
        </td>
      </tr>
    );
  });

  // 全�?取消全�?  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        const allKeys = sources.map((s) => s.key);
        setSelectedSources(new Set(allKeys));
      } else {
        setSelectedSources(new Set());
      }
    },
    [sources]
  );

  // 单个选择
  const handleSelectSource = useCallback((key: string, checked: boolean) => {
    setSelectedSources((prev) => {
      const newSelected = new Set(prev);
      if (checked) {
        newSelected.add(key);
      } else {
        newSelected.delete(key);
      }
      return newSelected;
    });
  }, []);

  // 批量操作
  const handleBatchOperation = async (
    action: 'batch_enable' | 'batch_disable' | 'batch_delete'
  ) => {
    if (selectedSources.size === 0) {
      showAlert({
        type: 'warning',
        title: '请先选择要操作的视频�?,
        message: '请选择至少一个视频源',
      });
      return;
    }

    const keys = Array.from(selectedSources);
    let confirmMessage = '';
    let actionName = '';

    switch (action) {
      case 'batch_enable':
        confirmMessage = `确定要启用选中�?${keys.length} 个视频源吗？`;
        actionName = '批量启用';
        break;
      case 'batch_disable':
        confirmMessage = `确定要禁用选中�?${keys.length} 个视频源吗？`;
        actionName = '批量禁用';
        break;
      case 'batch_delete':
        confirmMessage = `确定要删除选中�?${keys.length} 个视频源吗？此操作不可恢复！`;
        actionName = '批量删除';
        break;
    }

    // 显示确认弹窗
    setConfirmModal({
      isOpen: true,
      title: '确认操作',
      message: confirmMessage,
      onConfirm: async () => {
        try {
          const result = await withLoading(`batchSource_${action}`, () =>
            callSourceApi({ action, keys })
          );

          // 根据操作类型和结果显示不同的消息
          if (
            action === 'batch_delete' &&
            result?.deleted !== undefined &&
            result?.skipped !== undefined
          ) {
            const { deleted, skipped } = result;
            if (skipped > 0) {
              showAlert({
                type: 'warning',
                title: '批量删除完成',
                message: `成功删除�?${deleted} 个视频源，跳过了 ${skipped} 个配置文件中的源（不可删除）`,
                timer: 3000,
              });
            } else if (deleted > 0) {
              showAlert({
                type: 'success',
                title: '批量删除成功',
                message: `成功删除�?${deleted} 个视频源`,
                timer: 2000,
              });
            } else {
              showAlert({
                type: 'warning',
                title: '无法删除',
                message: '所选视频源均为配置文件中的源，不可删除',
                timer: 3000,
              });
            }
          } else {
            showAlert({
              type: 'success',
              title: `${actionName}成功`,
              message: `${actionName}�?${keys.length} 个视频源`,
              timer: 2000,
            });
          }

          // 重置选择状�?          setSelectedSources(new Set());
        } catch (err) {
          showAlert({
            type: 'error',
            title: `${actionName}失败`,
            message: err instanceof Error ? err.message : '操作失败',
          });
        }
        setConfirmModal({
          isOpen: false,
          title: '',
          message: '',
          onConfirm: () => {},
          onCancel: () => {},
        });
      },
      onCancel: () => {
        setConfirmModal({
          isOpen: false,
          title: '',
          message: '',
          onConfirm: () => {},
          onCancel: () => {},
        });
      },
    });
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载�?..
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 添加视频源表�?*/}
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
          视频源列�?        </h4>
        <div className='flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2'>
          {/* 批量操作按钮 - 移动端显示在下一行，PC端显示在左侧 */}
          {selectedSources.size > 0 && (
            <>
              <div className='flex flex-wrap items-center gap-3 order-2 sm:order-1'>
                <span className='text-sm text-gray-600 dark:text-gray-400'>
                  <span className='sm:hidden'>已�?{selectedSources.size}</span>
                  <span className='hidden sm:inline'>
                    已选择 {selectedSources.size} 个视频源
                  </span>
                </span>
                <button
                  onClick={() => handleBatchOperation('batch_enable')}
                  disabled={isLoading('batchSource_batch_enable')}
                  className={`px-3 py-1 text-sm ${
                    isLoading('batchSource_batch_enable')
                      ? buttonStyles.disabled
                      : buttonStyles.success
                  }`}
                >
                  {isLoading('batchSource_batch_enable')
                    ? '启用�?..'
                    : '批量启用'}
                </button>
                <button
                  onClick={() => handleBatchOperation('batch_disable')}
                  disabled={isLoading('batchSource_batch_disable')}
                  className={`px-3 py-1 text-sm ${
                    isLoading('batchSource_batch_disable')
                      ? buttonStyles.disabled
                      : buttonStyles.warning
                  }`}
                >
                  {isLoading('batchSource_batch_disable')
                    ? '禁用�?..'
                    : '批量禁用'}
                </button>
                <button
                  onClick={() => handleBatchOperation('batch_delete')}
                  disabled={isLoading('batchSource_batch_delete')}
                  className={`px-3 py-1 text-sm ${
                    isLoading('batchSource_batch_delete')
                      ? buttonStyles.disabled
                      : buttonStyles.danger
                  }`}
                >
                  {isLoading('batchSource_batch_delete')
                    ? '删除�?..'
                    : '批量删除'}
                </button>
              </div>
              <div className='hidden sm:block w-px h-6 bg-gray-300 dark:bg-gray-600 order-2'></div>
            </>
          )}
          <div className='flex items-center gap-2 overflow-x-auto whitespace-nowrap order-1 sm:order-2'>
            <button
              onClick={openWeightModal}
              className={`${buttonStyles.secondary} flex shrink-0 items-center gap-1.5 whitespace-nowrap`}
              title='拖动排序并批量生成推荐权�?
            >
              <Settings size={14} />
              <span>权重设置</span>
            </button>
            <button
              onClick={() => setShowValidationModal(true)}
              disabled={isValidating}
              className={`px-3 py-1 text-sm rounded-lg transition-colors flex shrink-0 items-center space-x-1 whitespace-nowrap ${
                isValidating ? buttonStyles.disabled : buttonStyles.primary
              }`}
            >
              {isValidating ? (
                <>
                  <div className='w-3 h-3 border border-white border-t-transparent rounded-full animate-spin'></div>
                  <span>检测中...</span>
                </>
              ) : (
                '有效性检�?
              )}
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className={`${
                showAddForm ? buttonStyles.secondary : buttonStyles.success
              } shrink-0 whitespace-nowrap`}
            >
              {showAddForm ? '取消' : '添加视频�?}
            </button>
          </div>
        </div>
      </div>

      {showAddForm && (
        <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <input
              type='text'
              placeholder='名称'
              value={newSource.name}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, name: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='Key'
              value={newSource.key}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, key: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='API 地址'
              value={newSource.api}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, api: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='Detail 地址（选填�?
              value={newSource.detail}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, detail: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>
          <div className='flex justify-end'>
            <button
              onClick={handleAddSource}
              disabled={
                !newSource.name ||
                !newSource.key ||
                !newSource.api ||
                isLoading('addSource')
              }
              className={`w-full sm:w-auto px-4 py-2 ${
                !newSource.name ||
                !newSource.key ||
                !newSource.api ||
                isLoading('addSource')
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('addSource') ? '添加�?..' : '添加'}
            </button>
          </div>
        </div>
      )}

      {/* 视频源表�?*/}
      <div
        className='border border-gray-200 dark:border-gray-700 rounded-lg max-h-[28rem] overflow-y-auto overflow-x-auto relative'
        data-table='source-list'
      >
        <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
          <thead className='bg-gray-50 dark:bg-gray-900 sticky top-0 z-10'>
            <tr>
              <th className='w-12 px-2 py-3 text-center'>
                <input
                  type='checkbox'
                  checked={selectAll}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
                />
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                名称
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                Key
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                API 地址
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                Detail 地址
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                状�?              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                代理模式
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                有效�?              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                操作
              </th>
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
            {sources.map((source) => (
              <SourceRow key={source.key} source={source} />
            ))}
          </tbody>
        </table>
      </div>

      {showWeightModal &&
        createPortal(
          <>
            <div
              className='fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000]'
              onClick={handleCloseWeightModal}
              onTouchMove={(e) => {
                e.preventDefault();
              }}
              onWheel={(e) => {
                e.preventDefault();
              }}
              style={{
                touchAction: 'none',
              }}
            />
            <div
              className='fixed left-1/2 top-1/2 z-[10001] flex w-[calc(100%-1rem)] max-w-6xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='flex items-start justify-between gap-4 border-b border-gray-200 dark:border-gray-700 px-6 py-5'>
                <div>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    视频源权重设�?                  </h3>
                </div>
                <button
                  onClick={handleCloseWeightModal}
                  className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-2xl leading-none'
                  aria-label='关闭权重设置弹窗'
                >
                  ×
                </button>
              </div>

              <div
                className='flex-1 min-h-0 overflow-y-auto px-0 overscroll-contain'
                data-panel-content
                data-weight-modal-scroll
                onTouchMove={(e) => {
                  e.stopPropagation();
                }}
                onWheel={(e) => {
                  e.stopPropagation();
                }}
                style={{
                  touchAction: 'pan-y',
                  overscrollBehavior: 'contain',
                }}
              >
                <div className='flex flex-wrap items-center justify-between gap-3 px-6 py-4'>
                  <div className='text-sm text-gray-600 dark:text-gray-400'>
                    排序越靠前，推荐权重越高；拖动后再次生成推荐值时，会把当前列表均匀映射�?                    0~40�?                  </div>
                  <div className='flex flex-wrap items-center gap-2'>
                    <button
                      onClick={handleApplyRecommendedWeights}
                      className={buttonStyles.primarySmall}
                    >
                      按当前顺序生成推荐权�?                    </button>
                    <button
                      onClick={handleResetWeightDraft}
                      className={buttonStyles.secondarySmall}
                    >
                      恢复当前配置
                    </button>
                  </div>
                </div>

                <div className='px-6 pb-6'>
                  <div className='overflow-x-auto'>
                    <div className='grid min-w-[820px] grid-cols-[88px_minmax(0,1fr)_112px_112px_220px] gap-3 px-4 pb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'>
                      <div>排序</div>
                      <div>视频�?/div>
                      <div>状�?/div>
                      <div>推荐�?/div>
                      <div>生效权重</div>
                    </div>
                    <div className='min-w-[820px] rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20 p-3'>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleWeightModalDragEnd}
                        autoScroll={false}
                        modifiers={[
                          restrictToVerticalAxis,
                          restrictToParentElement,
                        ]}
                      >
                        <SortableContext
                          items={weightDraftSources.map((source) => source.key)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className='space-y-3'>
                            {weightDraftSources.map((source, index) => {
                              const recommendedWeight =
                                recommendedWeightMap.get(source.key) ?? 0;
                              return (
                                <WeightModalRow
                                  key={source.key}
                                  source={source}
                                  index={index}
                                  recommendedWeight={recommendedWeight}
                                />
                              );
                            })}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  </div>
                </div>
              </div>

              <div className='flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4'>
                <div className='flex items-center gap-3'>
                  <button
                    onClick={handleCloseWeightModal}
                    className={buttonStyles.secondary}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveWeightConfig}
                    disabled={
                      !weightModalChanged || isLoading('saveWeightConfig')
                    }
                    className={`px-4 py-2 ${
                      !weightModalChanged || isLoading('saveWeightConfig')
                        ? buttonStyles.disabled
                        : buttonStyles.success
                    }`}
                  >
                    {isLoading('saveWeightConfig') ? '保存�?..' : '保存'}
                  </button>
                </div>
              </div>
            </div>
          </>,
          document.body
        )}

      {/* 有效性检测弹�?*/}
      {showValidationModal &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
            onClick={() => setShowValidationModal(false)}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4'
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-4'>
                视频源有效性检�?              </h3>
              <p className='text-sm text-gray-600 dark:text-gray-400 mb-4'>
                请输入检测用的搜索关键词
              </p>
              <div className='space-y-4'>
                <input
                  type='text'
                  placeholder='请输入搜索关键词'
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  onKeyPress={(e) =>
                    e.key === 'Enter' && handleValidateSources()
                  }
                />
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={() => setShowValidationModal(false)}
                    className='px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors'
                  >
                    取消
                  </button>
                  <button
                    onClick={handleValidateSources}
                    disabled={!searchKeyword.trim()}
                    className={`px-4 py-2 ${
                      !searchKeyword.trim()
                        ? buttonStyles.disabled
                        : buttonStyles.success
                    }`}
                  >
                    开始检�?                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
        onConfirm={alertModal.onConfirm}
      />

      {/* 批量操作确认弹窗 */}
      {confirmModal.isOpen &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={confirmModal.onCancel}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-4'>
                  <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                    {confirmModal.title}
                  </h3>
                  <button
                    onClick={confirmModal.onCancel}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-5 h-5'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='mb-6'>
                  <p className='text-sm text-gray-600 dark:text-gray-400'>
                    {confirmModal.message}
                  </p>
                </div>

                {/* 操作按钮 */}
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={confirmModal.onCancel}
                    className={`px-4 py-2 text-sm font-medium ${buttonStyles.secondary}`}
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmModal.onConfirm}
                    disabled={
                      isLoading('batchSource_batch_enable') ||
                      isLoading('batchSource_batch_disable') ||
                      isLoading('batchSource_batch_delete')
                    }
                    className={`px-4 py-2 text-sm font-medium ${
                      isLoading('batchSource_batch_enable') ||
                      isLoading('batchSource_batch_disable') ||
                      isLoading('batchSource_batch_delete')
                        ? buttonStyles.disabled
                        : buttonStyles.success
                    }`}
                  >
                    {isLoading('batchSource_batch_enable') ||
                    isLoading('batchSource_batch_disable') ||
                    isLoading('batchSource_batch_delete')
                      ? '操作�?..'
                      : '确认'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

// 分类配置组件
const CategoryConfig = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);
  const [newCategory, setNewCategory] = useState<CustomCategory>({
    name: '',
    type: 'movie',
    query: '',
    disabled: false,
    from: 'config',
  });

  // dnd-kit 传感�?  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 轻微位移即可触发
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 长按 150ms 后触发，避免与滚动冲�?        tolerance: 5,
      },
    })
  );

  // 初始�?  useEffect(() => {
    if (config?.CustomCategories) {
      setCategories(config.CustomCategories);
      // 进入时重�?orderChanged
      setOrderChanged(false);
    }
  }, [config]);

  // 通用 API 请求
  const callCategoryApi = async (body: Record<string, any>) => {
    try {
      const resp = await fetch('/api/admin/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `操作失败: ${resp.status}`);
      }

      // 成功后刷新配�?      await refreshConfig();
    } catch (err) {
      showError(err instanceof Error ? err.message : '操作失败', showAlert);
      throw err; // 向上抛出方便调用处判�?    }
  };

  const handleToggleEnable = (query: string, type: 'movie' | 'tv') => {
    const target = categories.find((c) => c.query === query && c.type === type);
    if (!target) return;
    const action = target.disabled ? 'enable' : 'disable';
    withLoading(`toggleCategory_${query}_${type}`, () =>
      callCategoryApi({ action, query, type })
    ).catch(() => {
      console.error('操作失败', action, query, type);
    });
  };

  const handleDelete = (query: string, type: 'movie' | 'tv') => {
    withLoading(`deleteCategory_${query}_${type}`, () =>
      callCategoryApi({ action: 'delete', query, type })
    ).catch(() => {
      console.error('操作失败', 'delete', query, type);
    });
  };

  const handleAddCategory = () => {
    if (!newCategory.name || !newCategory.query) return;
    withLoading('addCategory', async () => {
      await callCategoryApi({
        action: 'add',
        name: newCategory.name,
        type: newCategory.type,
        query: newCategory.query,
      });
      setNewCategory({
        name: '',
        type: 'movie',
        query: '',
        disabled: false,
        from: 'custom',
      });
      setShowAddForm(false);
    }).catch(() => {
      console.error('操作失败', 'add', newCategory);
    });
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex(
      (c) => `${c.query}:${c.type}` === active.id
    );
    const newIndex = categories.findIndex(
      (c) => `${c.query}:${c.type}` === over.id
    );
    setCategories((prev) => arrayMove(prev, oldIndex, newIndex));
    setOrderChanged(true);
  };

  const handleSaveOrder = () => {
    const order = categories.map((c) => `${c.query}:${c.type}`);
    withLoading('saveCategoryOrder', () =>
      callCategoryApi({ action: 'sort', order })
    )
      .then(() => {
        setOrderChanged(false);
      })
      .catch(() => {
        console.error('操作失败', 'sort', order);
      });
  };

  // 可拖拽行封装 (dnd-kit)
  const DraggableRow = ({ category }: { category: CustomCategory }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: `${category.query}:${category.type}` });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    } as React.CSSProperties;

    return (
      <tr
        ref={setNodeRef}
        style={style}
        className='hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors select-none'
      >
        <td
          className='px-2 py-4 cursor-grab text-gray-400'
          style={{ touchAction: 'none' }}
          {...{ ...attributes, ...listeners }}
        >
          <GripVertical size={16} />
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
          {category.name || '-'}
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              category.type === 'movie'
                ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                : 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
            }`}
          >
            {category.type === 'movie' ? '电影' : '电视�?}
          </span>
        </td>
        <td
          className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 max-w-[12rem] truncate'
          title={category.query}
        >
          {category.query}
        </td>
        <td className='px-6 py-4 whitespace-nowrap max-w-[1rem]'>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              !category.disabled
                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
            }`}
          >
            {!category.disabled ? '启用�? : '已禁�?}
          </span>
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
          <button
            onClick={() => handleToggleEnable(category.query, category.type)}
            disabled={isLoading(
              `toggleCategory_${category.query}_${category.type}`
            )}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
              !category.disabled
                ? buttonStyles.roundedDanger
                : buttonStyles.roundedSuccess
            } transition-colors ${
              isLoading(`toggleCategory_${category.query}_${category.type}`)
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            {!category.disabled ? '禁用' : '启用'}
          </button>
          {category.from !== 'config' && (
            <button
              onClick={() => handleDelete(category.query, category.type)}
              disabled={isLoading(
                `deleteCategory_${category.query}_${category.type}`
              )}
              className={`${buttonStyles.roundedSecondary} ${
                isLoading(`deleteCategory_${category.query}_${category.type}`)
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              删除
            </button>
          )}
        </td>
      </tr>
    );
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载�?..
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 添加分类表单 */}
      <div className='flex items-center justify-between'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
          自定义分类列�?        </h4>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
            showAddForm ? buttonStyles.secondary : buttonStyles.success
          }`}
        >
          {showAddForm ? '取消' : '添加分类'}
        </button>
      </div>

      {showAddForm && (
        <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <input
              type='text'
              placeholder='分类名称'
              value={newCategory.name}
              onChange={(e) =>
                setNewCategory((prev) => ({ ...prev, name: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <select
              value={newCategory.type}
              onChange={(e) =>
                setNewCategory((prev) => ({
                  ...prev,
                  type: e.target.value as 'movie' | 'tv',
                }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            >
              <option value='movie'>电影</option>
              <option value='tv'>电视�?/option>
            </select>
            <input
              type='text'
              placeholder='搜索关键�?
              value={newCategory.query}
              onChange={(e) =>
                setNewCategory((prev) => ({ ...prev, query: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>
          <div className='flex justify-end'>
            <button
              onClick={handleAddCategory}
              disabled={
                !newCategory.name ||
                !newCategory.query ||
                isLoading('addCategory')
              }
              className={`w-full sm:w-auto px-4 py-2 ${
                !newCategory.name ||
                !newCategory.query ||
                isLoading('addCategory')
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('addCategory') ? '添加�?..' : '添加'}
            </button>
          </div>
        </div>
      )}

      {/* 分类表格 */}
      <div className='border border-gray-200 dark:border-gray-700 rounded-lg max-h-[28rem] overflow-y-auto overflow-x-auto relative'>
        <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
          <thead className='bg-gray-50 dark:bg-gray-900 sticky top-0 z-10'>
            <tr>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                分类名称
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                类型
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                搜索关键�?              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                状�?              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                操作
              </th>
            </tr>
          </thead>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            autoScroll={false}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          >
            <SortableContext
              items={categories.map((c) => `${c.query}:${c.type}`)}
              strategy={verticalListSortingStrategy}
            >
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {categories.map((category) => (
                  <DraggableRow
                    key={`${category.query}:${category.type}`}
                    category={category}
                  />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      {/* 保存排序按钮 */}
      {orderChanged && (
        <div className='flex justify-end'>
          <button
            onClick={handleSaveOrder}
            disabled={isLoading('saveCategoryOrder')}
            className={`px-3 py-1.5 text-sm ${
              isLoading('saveCategoryOrder')
                ? buttonStyles.disabled
                : buttonStyles.primary
            }`}
          >
            {isLoading('saveCategoryOrder') ? '保存�?..' : '保存排序'}
          </button>
        </div>
      )}

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
        onConfirm={alertModal.onConfirm}
      />
    </div>
  );
};

const VideoSourceScriptLab = () => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [scripts, setScripts] = useState<StandaloneSourceScript[]>([]);
  const [loadingScripts, setLoadingScripts] = useState(true);
  const [template, setTemplate] = useState('');
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    id?: string;
    key: string;
    name: string;
    description: string;
    code: string;
    enabled: boolean;
    version?: string;
    updatedAt?: number;
  }>({
    key: '',
    name: '',
    description: '',
    code: '',
    enabled: true,
  });
  const [testHook, setTestHook] = useState<
    'getSources' | 'search' | 'recommend' | 'detail' | 'resolvePlayUrl'
  >('getSources');
  const [testPayload, setTestPayload] = useState(JSON.stringify({}, null, 2));
  const [testOutput, setTestOutput] = useState('');
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const applyEditorFromScript = (script: StandaloneSourceScript | null) => {
    if (!script) {
      setEditor({
        key: '',
        name: '',
        description: '',
        code: template,
        enabled: true,
      });
      setSelectedScriptId(null);
      return;
    }

    setEditor({
      id: script.id,
      key: script.key,
      name: script.name,
      description: script.description || '',
      code: script.code,
      enabled: script.enabled,
      version: script.version,
      updatedAt: script.updatedAt,
    });
    setSelectedScriptId(script.id);
  };

  const loadScripts = async (preferId?: string | null) => {
    setLoadingScripts(true);
    try {
      const response = await fetch('/api/admin/source-script', {
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '加载脚本失败');
      }

      const nextScripts = (data.items || []) as StandaloneSourceScript[];
      setScripts(nextScripts);
      setTemplate(data.template || '');

      const targetId =
        preferId !== undefined
          ? preferId
          : selectedScriptId || nextScripts[0]?.id || null;

      const selected = nextScripts.find((item) => item.id === targetId) || null;
      if (selected) {
        applyEditorFromScript(selected);
      } else {
        setEditor({
          key: '',
          name: '',
          description: '',
          code: data.template || '',
          enabled: true,
        });
        setSelectedScriptId(null);
      }
    } catch (error) {
      showError(
        error instanceof Error ? error.message : '加载脚本失败',
        showAlert
      );
    } finally {
      setLoadingScripts(false);
    }
  };

  useEffect(() => {
    loadScripts();
  }, []);

  const handleCreateNew = () => {
    setSelectedScriptId(null);
    setEditor({
      key: '',
      name: '',
      description: '',
      code: template,
      enabled: true,
    });
    setTestOutput('');
  };

  const handleExportCurrent = () => {
    if (!editor.key || !editor.name || !editor.code) {
      showError('当前没有可导出的脚本', showAlert);
      return;
    }

    const payload = {
      key: editor.key,
      name: editor.name,
      description: editor.description,
      code: editor.code,
      enabled: editor.enabled,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${editor.key}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      await withLoading('importSourceScript', async () => {
        const response = await fetch('/api/admin/source-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'import',
            items,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || '导入失败');
        }

        showSuccess(`已导�?${data.items?.length || 0} 个脚本`, showAlert);
        await loadScripts(data.items?.[0]?.id || null);
      });
    } catch (error) {
      showError(error instanceof Error ? error.message : '导入失败', showAlert);
    } finally {
      event.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!editor.key || !editor.name || !editor.code) {
      showError('请填写脚�?Key、名称和代码', showAlert);
      return;
    }

    await withLoading('saveSourceScript', async () => {
      const response = await fetch('/api/admin/source-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          id: editor.id,
          key: editor.key,
          name: editor.name,
          description: editor.description,
          code: editor.code,
          enabled: editor.enabled,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '保存失败');
      }

      showSuccess('脚本已保�?, showAlert);
      await loadScripts(data.item?.id || editor.id || null);
    }).catch((error) => {
      showError(error instanceof Error ? error.message : '保存失败', showAlert);
    });
  };

  const handleDelete = async () => {
    if (!editor.id) {
      handleCreateNew();
      return;
    }

    showAlert({
      type: 'warning',
      title: '删除脚本',
      message: `确定要删除脚�?"${editor.name}" 吗？`,
      showConfirm: true,
      onConfirm: async () => {
        hideAlert();
        await withLoading('deleteSourceScript', async () => {
          const response = await fetch('/api/admin/source-script', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'delete',
              id: editor.id,
            }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data.error || '删除失败');
          }
          showSuccess('脚本已删�?, showAlert);
          await loadScripts(null);
        }).catch((error) => {
          showError(
            error instanceof Error ? error.message : '删除失败',
            showAlert
          );
        });
      },
    });
  };

  const handleToggleEnabled = async (id: string) => {
    await withLoading(`toggleSourceScript_${id}`, async () => {
      const response = await fetch('/api/admin/source-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_enabled',
          id,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '更新失败');
      }
      await loadScripts(id);
    }).catch((error) => {
      showError(error instanceof Error ? error.message : '更新失败', showAlert);
    });
  };

  const handleTest = async () => {
    let payload = {};
    try {
      payload = testPayload.trim() ? JSON.parse(testPayload) : {};
    } catch {
      showError('测试输入必须是合�?JSON', showAlert);
      return;
    }

    await withLoading('testSourceScript', async () => {
      const response = await fetch('/api/admin/source-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          key: editor.key || 'test-script',
          name: editor.name || '测试脚本',
          code: editor.code,
          hook: testHook,
          payload,
        }),
      });
      const data = await response.json().catch(() => ({}));
      setTestOutput(JSON.stringify(data, null, 2));
      if (!response.ok) {
        throw new Error(data.error || data.message || '测试失败');
      }
      showSuccess('测试执行完成', showAlert);
    }).catch((error) => {
      showError(error instanceof Error ? error.message : '测试失败', showAlert);
    });
  };

  useEffect(() => {
    setTestPayload(
      testHook === 'getSources'
        ? JSON.stringify({}, null, 2)
        : testHook === 'search'
        ? JSON.stringify(
            { keyword: '凡人修仙�?, page: 1, sourceId: 'main' },
            null,
            2
          )
        : testHook === 'recommend'
        ? JSON.stringify({ page: 1 }, null, 2)
        : testHook === 'detail'
        ? JSON.stringify({ id: 'demo-id', sourceId: 'main' }, null, 2)
        : JSON.stringify(
            {
              sourceId: 'main',
              playUrl: 'https://example.com/video.m3u8',
              episodeIndex: 0,
            },
            null,
            2
          )
    );
  }, [testHook]);

  return (
    <div className='space-y-6'>
      <div className='flex flex-col lg:flex-row gap-6'>
        <div className='lg:w-80 space-y-4'>
          <div className='flex items-center justify-between'>
            <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              脚本列表
            </h4>
            <div className='flex items-center gap-2'>
              <input
                ref={importInputRef}
                type='file'
                accept='application/json,.json'
                onChange={handleImportFile}
                className='hidden'
              />
              <button
                onClick={() => importInputRef.current?.click()}
                disabled={isLoading('importSourceScript')}
                className={
                  isLoading('importSourceScript')
                    ? buttonStyles.disabledSmall
                    : buttonStyles.primarySmall
                }
              >
                导入
              </button>
              <button
                onClick={() => loadScripts(selectedScriptId)}
                disabled={loadingScripts}
                className={
                  loadingScripts
                    ? buttonStyles.disabledSmall
                    : buttonStyles.secondarySmall
                }
              >
                刷新
              </button>
              <button
                onClick={handleCreateNew}
                className={buttonStyles.successSmall}
              >
                新建
              </button>
            </div>
          </div>

          <div className='space-y-3 max-h-[38rem] overflow-y-auto pr-1'>
            {loadingScripts ? (
              <div className='text-sm text-gray-500 dark:text-gray-400'>
                加载�?..
              </div>
            ) : scripts.length === 0 ? (
              <div className='p-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400'>
                还没有脚本，点右上角新建一个�?              </div>
            ) : (
              scripts.map((script) => (
                <button
                  key={script.id}
                  onClick={() => {
                    applyEditorFromScript(script);
                    setTestOutput('');
                  }}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${
                    selectedScriptId === script.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                  }`}
                >
                  <div className='flex items-center justify-between gap-3'>
                    <div className='min-w-0'>
                      <div className='font-medium text-gray-900 dark:text-gray-100 truncate'>
                        {script.name}
                      </div>
                      <div className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                        {script.key}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        script.enabled
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {script.enabled ? '启用' : '停用'}
                    </span>
                  </div>
                  <div className='mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400'>
                    <span>
                      {new Date(script.updatedAt).toLocaleString('zh-CN')}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleEnabled(script.id);
                      }}
                      disabled={isLoading(`toggleSourceScript_${script.id}`)}
                      className={
                        script.enabled
                          ? buttonStyles.warningSmall
                          : buttonStyles.successSmall
                      }
                    >
                      {script.enabled ? '停用' : '启用'}
                    </button>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className='flex-1 space-y-6'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <input
              type='text'
              placeholder='脚本名称'
              value={editor.name}
              onChange={(e) =>
                setEditor((prev) => ({ ...prev, name: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='脚本 Key'
              value={editor.key}
              onChange={(e) =>
                setEditor((prev) => ({ ...prev, key: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>

          <textarea
            placeholder='脚本描述（可选）'
            value={editor.description}
            onChange={(e) =>
              setEditor((prev) => ({ ...prev, description: e.target.value }))
            }
            rows={2}
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
          />

          <div>
            <div className='flex items-center justify-between mb-2'>
              <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                脚本代码
              </label>
              <div className='text-xs text-gray-500 dark:text-gray-400'>
                {editor.version ? `当前版本: ${editor.version}` : '未保�?}
              </div>
            </div>
            <textarea
              value={editor.code}
              onChange={(e) =>
                setEditor((prev) => ({ ...prev, code: e.target.value }))
              }
              rows={24}
              spellCheck={false}
              className='w-full px-3 py-3 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-950 text-gray-100'
            />
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <button
              onClick={handleSave}
              disabled={isLoading('saveSourceScript')}
              className={
                isLoading('saveSourceScript')
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }
            >
              {isLoading('saveSourceScript') ? '保存�?..' : '保存脚本'}
            </button>
            <button
              onClick={handleTest}
              disabled={isLoading('testSourceScript')}
              className={
                isLoading('testSourceScript')
                  ? buttonStyles.disabled
                  : buttonStyles.primary
              }
            >
              {isLoading('testSourceScript') ? '测试�?..' : '运行测试'}
            </button>
            <button
              onClick={handleExportCurrent}
              className={buttonStyles.secondary}
            >
              导出当前脚本
            </button>
            <button onClick={handleDelete} className={buttonStyles.danger}>
              {editor.id ? '删除脚本' : '清空编辑�?}
            </button>
          </div>

          <div className='grid grid-cols-1 xl:grid-cols-2 gap-6'>
            <div className='space-y-3'>
              <div className='flex items-center gap-3'>
                <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  测试 Hook
                </label>
                <select
                  value={testHook}
                  onChange={(e) =>
                    setTestHook(
                      e.target.value as
                        | 'getSources'
                        | 'search'
                        | 'recommend'
                        | 'detail'
                        | 'resolvePlayUrl'
                    )
                  }
                  className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                >
                  <option value='getSources'>getSources</option>
                  <option value='search'>search</option>
                  <option value='recommend'>recommend</option>
                  <option value='detail'>detail</option>
                  <option value='resolvePlayUrl'>resolvePlayUrl</option>
                </select>
              </div>
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                现在脚本可以自己管理多个源，测试入参可传 `sourceId`�?              </p>
              <textarea
                value={testPayload}
                onChange={(e) => setTestPayload(e.target.value)}
                rows={10}
                spellCheck={false}
                className='w-full px-3 py-3 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>

            <div className='space-y-3'>
              <div className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                测试输出
              </div>
              <pre className='w-full min-h-[16rem] whitespace-pre-wrap break-all px-3 py-3 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-950 text-gray-100 overflow-auto'>
                {testOutput || '运行测试后会显示结果、日志和错误信息'}
              </pre>
            </div>
          </div>
        </div>
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
        onConfirm={alertModal.onConfirm}
      />
    </div>
  );
};

// 新增配置文件组件
const ConfigFileComponent = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [configContent, setConfigContent] = useState('');
  const [subscriptionUrl, setSubscriptionUrl] = useState('');
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');

  useEffect(() => {
    if (config?.ConfigFile) {
      setConfigContent(config.ConfigFile);
    }
    if (config?.ConfigSubscribtion) {
      setSubscriptionUrl(config.ConfigSubscribtion.URL);
      setAutoUpdate(config.ConfigSubscribtion.AutoUpdate);
      setLastCheckTime(config.ConfigSubscribtion.LastCheck || '');
    }
  }, [config]);

  // 拉取订阅配置
  const handleFetchConfig = async () => {
    if (!subscriptionUrl.trim()) {
      showError('请输入订阅URL', showAlert);
      return;
    }

    await withLoading('fetchConfig', async () => {
      try {
        const resp = await fetch('/api/admin/config_subscription/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: subscriptionUrl }),
        });

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || `拉取失败: ${resp.status}`);
        }

        const data = await resp.json();
        if (data.configContent) {
          setConfigContent(data.configContent);
          // 更新本地配置的最后检查时�?          const currentTime = new Date().toISOString();
          setLastCheckTime(currentTime);
          showSuccess('配置拉取成功', showAlert);
        } else {
          showError('拉取失败：未获取到配置内�?, showAlert);
        }
      } catch (err) {
        showError(err instanceof Error ? err.message : '拉取失败', showAlert);
        throw err;
      }
    });
  };

  // 处理文件上传
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 检查文件类�?    if (!file.name.toLowerCase().endsWith('.json')) {
      showError('请上传JSON格式的文�?, showAlert);
      return;
    }

    await withLoading('uploadConfig', async () => {
      try {
        const fileContent = await file.text();

        // 验证JSON格式
        let parsedConfig;
        try {
          parsedConfig = JSON.parse(fileContent);
        } catch (parseError) {
          showError('JSON格式错误，请检查文件内�?, showAlert);
          return;
        }

        // 检查是否包含api_site字段
        if (!parsedConfig.api_site) {
          showError('配置文件必须包含api_site字段', showAlert);
          return;
        }

        // 根据api字段进行去重
        const existingConfig = configContent
          ? JSON.parse(configContent)
          : { api_site: {} };
        const existingApis = new Set();

        // 收集现有配置中的所有api
        Object.values(existingConfig.api_site || {}).forEach((site: any) => {
          if (site.api) {
            existingApis.add(site.api);
          }
        });

        // 合并新配置，去重处理
        const mergedApiSite = { ...existingConfig.api_site };
        let duplicateCount = 0;

        Object.entries(parsedConfig.api_site || {}).forEach(
          ([key, site]: [string, any]) => {
            if (site.api && existingApis.has(site.api)) {
              duplicateCount++;
              // 跳过重复的api
              return;
            }
            mergedApiSite[key] = site;
          }
        );

        const mergedConfig = {
          ...parsedConfig,
          api_site: mergedApiSite,
        };

        // 更新配置内容
        setConfigContent(JSON.stringify(mergedConfig, null, 2));

        const message =
          duplicateCount > 0
            ? `配置上传成功，跳过了 ${duplicateCount} 个重复的API`
            : '配置上传成功';
        showSuccess(message, showAlert);
      } catch (err) {
        showError(
          err instanceof Error ? err.message : '文件上传失败',
          showAlert
        );
        throw err;
      }
    });

    // 清空文件输入
    event.target.value = '';
  };

  // 保存配置文件
  const handleSave = async () => {
    await withLoading('saveConfig', async () => {
      try {
        const resp = await fetch('/api/admin/config_file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            configFile: configContent,
            subscriptionUrl,
            autoUpdate,
            lastCheckTime: lastCheckTime || new Date().toISOString(),
          }),
        });

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || `保存失败: ${resp.status}`);
        }

        showSuccess('配置文件保存成功', showAlert);
        await refreshConfig();
      } catch (err) {
        showError(err instanceof Error ? err.message : '保存失败', showAlert);
        throw err;
      }
    });
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载�?..
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {/* 配置订阅区域 */}
      <div className='bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm'>
        <div className='flex items-center justify-between mb-6'>
          <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
            配置订阅
          </h3>
          <div className='text-sm text-gray-500 dark:text-gray-400 px-3 py-1.5 rounded-full'>
            最后更�?{' '}
            {lastCheckTime
              ? new Date(lastCheckTime).toLocaleString('zh-CN')
              : '从未更新'}
          </div>
        </div>

        <div className='space-y-6'>
          {/* 订阅URL输入 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
              订阅URL
            </label>
            <input
              type='url'
              value={subscriptionUrl}
              onChange={(e) => setSubscriptionUrl(e.target.value)}
              placeholder='https://example.com/config.json'
              disabled={false}
              className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 shadow-sm hover:border-gray-400 dark:hover:border-gray-500'
            />
            <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
              输入配置文件的订阅地址，要�?JSON 格式，且使用 Base58 编码
            </p>
          </div>

          {/* 拉取配置按钮 */}
          <div className='pt-2'>
            <button
              onClick={handleFetchConfig}
              disabled={isLoading('fetchConfig') || !subscriptionUrl.trim()}
              className={`w-full px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                isLoading('fetchConfig') || !subscriptionUrl.trim()
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('fetchConfig') ? (
                <div className='flex items-center justify-center gap-2'>
                  <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                  拉取中�?                </div>
              ) : (
                '拉取配置'
              )}
            </button>
          </div>

          {/* 自动更新开�?*/}
          <div className='flex items-center justify-between'>
            <div>
              <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                自动更新
              </label>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                启用后系统将定期自动拉取最新配�?              </p>
            </div>
            <button
              type='button'
              onClick={() => setAutoUpdate(!autoUpdate)}
              disabled={false}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                autoUpdate ? buttonStyles.toggleOn : buttonStyles.toggleOff
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full ${
                  buttonStyles.toggleThumb
                } transition-transform ${
                  autoUpdate
                    ? buttonStyles.toggleThumbOn
                    : buttonStyles.toggleThumbOff
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 配置文件编辑区域 */}
      <div className='space-y-4'>
        <div className='relative'>
          <textarea
            value={configContent}
            onChange={(e) => setConfigContent(e.target.value)}
            rows={20}
            placeholder='请输入配置文件内容（JSON 格式�?..'
            disabled={false}
            className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm leading-relaxed resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-400 dark:hover:border-gray-500'
            style={{
              fontFamily:
                'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
            }}
            spellCheck={false}
            data-gramm={false}
          />
        </div>

        {/* 文件上传区域 */}
        <div className='border-t border-gray-200 dark:border-gray-700 pt-4'>
          <div className='flex items-center justify-between mb-3'>
            <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              上传JSON配置文件
            </label>
            <div className='text-xs text-gray-500 dark:text-gray-400'>
              支持根据API字段自动去重
            </div>
          </div>
          <div className='relative'>
            <input
              type='file'
              accept='.json'
              onChange={handleFileUpload}
              disabled={isLoading('uploadConfig')}
              className='hidden'
              id='json-file-upload'
            />
            <label
              htmlFor='json-file-upload'
              className={`flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer transition-colors ${
                isLoading('uploadConfig')
                  ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-50'
                  : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              <div className='flex items-center space-x-2'>
                {isLoading('uploadConfig') ? (
                  <>
                    <div className='w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin'></div>
                    <span className='text-sm text-gray-600 dark:text-gray-400'>
                      上传�?..
                    </span>
                  </>
                ) : (
                  <>
                    <svg
                      className='w-5 h-5 text-gray-400'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12'
                      />
                    </svg>
                    <span className='text-sm text-gray-600 dark:text-gray-400'>
                      点击选择JSON文件或拖拽到此处
                    </span>
                  </>
                )}
              </div>
            </label>
          </div>
          <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
            上传的JSON配置将自动合并到当前配置，重复的API地址将被自动过滤
          </p>
        </div>

        <div className='flex items-center justify-between'>
          <div className='text-xs text-gray-500 dark:text-gray-400'>
            支持 JSON 格式，用于配置视频源和自定义分类
          </div>
          <button
            onClick={handleSave}
            disabled={isLoading('saveConfig')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isLoading('saveConfig')
                ? buttonStyles.disabled
                : buttonStyles.success
            }`}
          >
            {isLoading('saveConfig') ? '保存中�? : '保存'}
          </button>
        </div>
      </div>

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

// 个性化配置组件
const ThemeConfigComponent = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [themeSettings, setThemeSettings] = useState({
    enableBuiltInTheme: false,
    builtInTheme: 'default',
    customCSS: '',
    enableCache: true,
    cacheMinutes: 1440, // 默认1天（1440分钟�?    progressThumbType: 'default' as 'default' | 'preset' | 'custom',
    progressThumbPresetId: '',
    progressThumbCustomUrl: '',
  });
  const [loginBackgroundImages, setLoginBackgroundImages] = useState<string[]>([
    '',
  ]);
  const [registerBackgroundImages, setRegisterBackgroundImages] = useState<
    string[]
  >(['']);
  const [homeBackgroundImages, setHomeBackgroundImages] = useState<string[]>([
    '',
  ]);

  useEffect(() => {
    if (config?.ThemeConfig) {
      setThemeSettings({
        enableBuiltInTheme: config.ThemeConfig.enableBuiltInTheme || false,
        builtInTheme: config.ThemeConfig.builtInTheme || 'default',
        customCSS: config.ThemeConfig.customCSS || '',
        enableCache: config.ThemeConfig.enableCache !== false,
        cacheMinutes: config.ThemeConfig.cacheMinutes || 1440,
        progressThumbType: config.ThemeConfig.progressThumbType || 'default',
        progressThumbPresetId: config.ThemeConfig.progressThumbPresetId || '',
        progressThumbCustomUrl: config.ThemeConfig.progressThumbCustomUrl || '',
      });

      // 解析背景图配�?      if (config.ThemeConfig.loginBackgroundImage) {
        const urls = config.ThemeConfig.loginBackgroundImage
          .split('\n')
          .map((url) => url.trim())
          .filter((url) => url !== '');
        setLoginBackgroundImages(urls.length > 0 ? urls : ['']);
      } else {
        setLoginBackgroundImages(['']);
      }

      if (config.ThemeConfig.registerBackgroundImage) {
        const urls = config.ThemeConfig.registerBackgroundImage
          .split('\n')
          .map((url) => url.trim())
          .filter((url) => url !== '');
        setRegisterBackgroundImages(urls.length > 0 ? urls : ['']);
      } else {
        setRegisterBackgroundImages(['']);
      }

      if (config.ThemeConfig.homeBackgroundImage) {
        const urls = config.ThemeConfig.homeBackgroundImage
          .split('\n')
          .map((url) => url.trim())
          .filter((url) => url !== '');
        setHomeBackgroundImages(urls.length > 0 ? urls : ['']);
      } else {
        setHomeBackgroundImages(['']);
      }
    }
  }, [config]);

  const handleSave = async () => {
    await withLoading('saveThemeConfig', async () => {
      try {
        // 验证登录背景图URL格式
        const validLoginUrls = loginBackgroundImages
          .map((url) => url.trim())
          .filter((url) => url !== '');

        for (const url of validLoginUrls) {
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            showAlert({
              type: 'error',
              title: '格式错误',
              message: `登录界面背景图URL格式错误�?{url}\n每个URL必须以http://或https://开头`,
              showConfirm: true,
            });
            return;
          }
        }

        // 验证注册背景图URL格式
        const validRegisterUrls = registerBackgroundImages
          .map((url) => url.trim())
          .filter((url) => url !== '');

        for (const url of validRegisterUrls) {
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            showAlert({
              type: 'error',
              title: '格式错误',
              message: `注册界面背景图URL格式错误�?{url}\n每个URL必须以http://或https://开头`,
              showConfirm: true,
            });
            return;
          }
        }

        const validHomeUrls = homeBackgroundImages
          .map((url) => url.trim())
          .filter((url) => url !== '');

        for (const url of validHomeUrls) {
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            showAlert({
              type: 'error',
              title: '格式错误',
              message: `首页背景图URL格式错误�?{url}\n每个URL必须以http://或https://开头`,
              showConfirm: true,
            });
            return;
          }
        }

        const response = await fetch('/api/admin/theme', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...themeSettings,
            loginBackgroundImage: validLoginUrls.join('\n'),
            registerBackgroundImage: validRegisterUrls.join('\n'),
            homeBackgroundImage: validHomeUrls.join('\n'),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || '保存失败');
        }

        showAlert({
          type: 'success',
          title: '保存成功',
          message: '个性化配置已更�?,
          timer: 2000,
        });

        await refreshConfig();

        // 刷新页面以应用新主题
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (error) {
        showAlert({
          type: 'error',
          title: '保存失败',
          message: (error as Error).message,
        });
      }
    });
  };

  const builtInThemes = [
    {
      value: 'default',
      label: '默认主题',
      color: '#3b82f6',
    },
    {
      value: 'dark_blue',
      label: '深蓝夜空',
      color: '#3b82f6',
    },
    {
      value: 'purple_dream',
      label: '紫色梦境',
      color: '#a78bfa',
    },
    {
      value: 'green_forest',
      label: '翠绿森林',
      color: '#10b981',
    },
    {
      value: 'orange_sunset',
      label: '橙色日落',
      color: '#f97316',
    },
    {
      value: 'pink_candy',
      label: '粉色糖果',
      color: '#ec4899',
    },
    {
      value: 'cyan_ocean',
      label: '青色海洋',
      color: '#06b6d4',
    },
  ];

  return (
    <div className='space-y-6'>
      {/* 主题类型选择 */}
      <div className='bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700'>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4'>
          主题类型
        </h3>
        <div className='space-y-4'>
          <label className='flex items-center space-x-3 cursor-pointer'>
            <input
              type='radio'
              checked={!themeSettings.enableBuiltInTheme}
              onChange={() =>
                setThemeSettings((prev) => ({
                  ...prev,
                  enableBuiltInTheme: false,
                }))
              }
              className='w-4 h-4 text-blue-600'
            />
            <span className='text-gray-900 dark:text-gray-100'>
              自定义CSS（使用下方的CSS编辑器）
            </span>
          </label>
          <label className='flex items-center space-x-3 cursor-pointer'>
            <input
              type='radio'
              checked={themeSettings.enableBuiltInTheme}
              onChange={() =>
                setThemeSettings((prev) => ({
                  ...prev,
                  enableBuiltInTheme: true,
                }))
              }
              className='w-4 h-4 text-blue-600'
            />
            <span className='text-gray-900 dark:text-gray-100'>
              内置主题（使用预设的主题样式�?            </span>
          </label>
        </div>
      </div>

      {/* 内置主题选择 */}
      {themeSettings.enableBuiltInTheme && (
        <div className='bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700'>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4'>
            选择内置主题
          </h3>
          <div className='flex flex-wrap gap-3'>
            {builtInThemes.map((theme) => (
              <div
                key={theme.value}
                onClick={() =>
                  setThemeSettings((prev) => ({
                    ...prev,
                    builtInTheme: theme.value,
                  }))
                }
                className={`cursor-pointer rounded-lg border-2 p-3 transition-all hover:shadow-md ${
                  themeSettings.builtInTheme === theme.value
                    ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className='flex items-center gap-3'>
                  {/* 圆形颜色预览 */}
                  <div
                    className='w-10 h-10 rounded-full flex-shrink-0 shadow-sm'
                    style={{ backgroundColor: theme.color }}
                  />
                  {/* 主题名称 */}
                  <div className='flex items-center gap-2'>
                    <span className='text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap'>
                      {theme.label}
                    </span>
                    {themeSettings.builtInTheme === theme.value && (
                      <div className='w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0'>
                        <svg
                          className='w-2.5 h-2.5 text-white'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={3}
                            d='M5 13l4 4L19 7'
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className='mt-4 text-sm text-gray-600 dark:text-gray-400'>
            注意：启用内置主题时，自定义CSS将被禁用
          </p>
        </div>
      )}

      {/* 自定义CSS编辑�?*/}
      {!themeSettings.enableBuiltInTheme && (
        <div className='bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700'>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4'>
            自定义CSS
          </h3>
          <textarea
            value={themeSettings.customCSS}
            onChange={(e) =>
              setThemeSettings((prev) => ({
                ...prev,
                customCSS: e.target.value,
              }))
            }
            placeholder='在此输入自定义CSS代码...'
            className='w-full h-96 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          />
          <p className='mt-2 text-sm text-gray-600 dark:text-gray-400'>
            提示：可以使用CSS变量、媒体查询等高级特�?          </p>
        </div>
      )}

      {/* 缓存设置 */}
      <div className='bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700'>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4'>
          缓存设置
        </h3>
        <div className='space-y-4'>
          <label className='flex items-center space-x-3 cursor-pointer'>
            <input
              type='checkbox'
              checked={themeSettings.enableCache}
              onChange={(e) =>
                setThemeSettings((prev) => ({
                  ...prev,
                  enableCache: e.target.checked,
                }))
              }
              className='w-4 h-4 text-blue-600 rounded'
            />
            <span className='text-gray-900 dark:text-gray-100'>
              启用浏览器缓存（推荐�?            </span>
          </label>

          {themeSettings.enableCache && (
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                缓存时间（分钟）
              </label>
              <input
                type='number'
                min='1'
                max='43200'
                value={themeSettings.cacheMinutes}
                onChange={(e) =>
                  setThemeSettings((prev) => ({
                    ...prev,
                    cacheMinutes: parseInt(e.target.value) || 1440,
                  }))
                }
                className='w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              />
              <p className='mt-2 text-sm text-gray-600 dark:text-gray-400'>
                建议值：60分钟�?小时）�?440分钟�?天）�?0080分钟�?天）
              </p>
            </div>
          )}
        </div>
        <p className='mt-4 text-sm text-gray-600 dark:text-gray-400'>
          启用后，用户浏览器会缓存CSS文件指定时间，减少服务器负载。启用该项可能会导致主题更新延迟�?        </p>
      </div>

      {/* 背景图配�?*/}
      <div className='bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700'>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4'>
          背景图配�?        </h3>
        <div className='space-y-6'>
          {/* 登录界面背景�?*/}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              登录界面背景�?            </label>
            <div className='space-y-2'>
              {loginBackgroundImages.map((url, index) => (
                <div key={index} className='flex gap-2'>
                  <input
                    type='text'
                    value={url}
                    onChange={(e) => {
                      const newImages = [...loginBackgroundImages];
                      newImages[index] = e.target.value;
                      setLoginBackgroundImages(newImages);
                    }}
                    placeholder='请输入登录界面背景图URL (http:// �?https://)'
                    className='flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm'
                  />
                  {loginBackgroundImages.length > 1 && (
                    <button
                      type='button'
                      onClick={() => {
                        setLoginBackgroundImages(
                          loginBackgroundImages.filter((_, i) => i !== index)
                        );
                      }}
                      className='px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors'
                      title='删除'
                    >
                      <svg
                        className='w-5 h-5'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M6 18L18 6M6 6l12 12'
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <button
                type='button'
                onClick={() =>
                  setLoginBackgroundImages([...loginBackgroundImages, ''])
                }
                className='flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors'
              >
                <svg
                  className='w-5 h-5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 4v16m8-8H4'
                  />
                </svg>
                <span>添加URL</span>
              </button>
            </div>
          </div>

          {/* 注册界面背景�?*/}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              注册界面背景�?            </label>
            <div className='space-y-2'>
              {registerBackgroundImages.map((url, index) => (
                <div key={index} className='flex gap-2'>
                  <input
                    type='text'
                    value={url}
                    onChange={(e) => {
                      const newImages = [...registerBackgroundImages];
                      newImages[index] = e.target.value;
                      setRegisterBackgroundImages(newImages);
                    }}
                    placeholder='请输入注册界面背景图URL (http:// �?https://)'
                    className='flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm'
                  />
                  {registerBackgroundImages.length > 1 && (
                    <button
                      type='button'
                      onClick={() => {
                        setRegisterBackgroundImages(
                          registerBackgroundImages.filter((_, i) => i !== index)
                        );
                      }}
                      className='px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors'
                      title='删除'
                    >
                      <svg
                        className='w-5 h-5'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M6 18L18 6M6 6l12 12'
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <button
                type='button'
                onClick={() =>
                  setRegisterBackgroundImages([...registerBackgroundImages, ''])
                }
                className='flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors'
              >
                <svg
                  className='w-5 h-5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 4v16m8-8H4'
                  />
                </svg>
                <span>添加URL</span>
              </button>
            </div>
          </div>

          {/* 首页背景�?*/}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              首页背景�?            </label>
            <div className='space-y-2'>
              {homeBackgroundImages.map((url, index) => (
                <div key={index} className='flex gap-2'>
                  <input
                    type='text'
                    value={url}
                    onChange={(e) => {
                      const newImages = [...homeBackgroundImages];
                      newImages[index] = e.target.value;
                      setHomeBackgroundImages(newImages);
                    }}
                    placeholder='请输入首页背景图URL (http:// �?https://)'
                    className='flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm'
                  />
                  {homeBackgroundImages.length > 1 && (
                    <button
                      type='button'
                      onClick={() => {
                        setHomeBackgroundImages(
                          homeBackgroundImages.filter((_, i) => i !== index)
                        );
                      }}
                      className='px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors'
                      title='删除'
                    >
                      <svg
                        className='w-5 h-5'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M6 18L18 6M6 6l12 12'
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <button
                type='button'
                onClick={() =>
                  setHomeBackgroundImages([...homeBackgroundImages, ''])
                }
                className='flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors'
              >
                <svg
                  className='w-5 h-5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 4v16m8-8H4'
                  />
                </svg>
                <span>添加URL</span>
              </button>
            </div>
          </div>
        </div>
        <p className='mt-4 text-sm text-gray-600 dark:text-gray-400'>
          配置登录、注册和首页的背景图链接，留空则使用默认样式。支持配置多张图片，将随机展示其中一�?        </p>
      </div>

      {/* 进度条图标配�?*/}
      <div className='bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700'>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2'>
          <Palette className='w-5 h-5' />
          进度条图�?        </h3>
        <p className='text-sm text-gray-600 dark:text-gray-400 mb-4'>
          自定义视频播放器进度条的滑块图标，让播放器更具个�?        </p>

        {/* 图标类型选择 */}
        <div className='space-y-4 mb-6'>
          <label className='flex items-center space-x-3 cursor-pointer'>
            <input
              type='radio'
              checked={themeSettings.progressThumbType === 'default'}
              onChange={() =>
                setThemeSettings((prev) => ({
                  ...prev,
                  progressThumbType: 'default',
                }))
              }
              className='w-4 h-4 text-blue-600'
            />
            <span className='text-gray-900 dark:text-gray-100'>默认圆点</span>
          </label>
          <label className='flex items-center space-x-3 cursor-pointer'>
            <input
              type='radio'
              checked={themeSettings.progressThumbType === 'preset'}
              onChange={() =>
                setThemeSettings((prev) => ({
                  ...prev,
                  progressThumbType: 'preset',
                }))
              }
              className='w-4 h-4 text-blue-600'
            />
            <span className='text-gray-900 dark:text-gray-100'>内置图标</span>
          </label>
          <label className='flex items-center space-x-3 cursor-pointer'>
            <input
              type='radio'
              checked={themeSettings.progressThumbType === 'custom'}
              onChange={() =>
                setThemeSettings((prev) => ({
                  ...prev,
                  progressThumbType: 'custom',
                }))
              }
              className='w-4 h-4 text-blue-600'
            />
            <span className='text-gray-900 dark:text-gray-100'>自定义图�?/span>
          </label>
        </div>

        {/* 预制图标选择 */}
        {themeSettings.progressThumbType === 'preset' && (
          <div className='space-y-3 mb-4'>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
              选择内置图标
            </label>
            <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
              {[
                {
                  id: 'renako',
                  name: '玲奈�?,
                  url: '/icons/q/renako.png',
                  color: '#ec4899',
                },
                {
                  id: 'irena',
                  name: '伊蕾�?,
                  url: '/icons/q/irena.png',
                  color: '#f8fafc',
                },
                {
                  id: 'emilia',
                  name: '爱蜜莉雅',
                  url: '/icons/q/emilia.png',
                  color: '#f8fafc',
                },
              ].map((thumb) => (
                <button
                  key={thumb.id}
                  type='button'
                  onClick={() =>
                    setThemeSettings((prev) => ({
                      ...prev,
                      progressThumbPresetId: thumb.id,
                    }))
                  }
                  className={`relative p-4 border-2 rounded-lg transition-all ${
                    themeSettings.progressThumbPresetId === thumb.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <div className='flex flex-col items-center gap-2'>
                    <img
                      src={thumb.url}
                      alt={thumb.name}
                      className='w-12 h-12 object-contain'
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"%3E%3Crect width="48" height="48" fill="%23ddd"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3E?%3C/text%3E%3C/svg%3E';
                      }}
                    />
                    <span className='text-sm font-medium text-gray-700 dark:text-gray-300 text-center'>
                      {thumb.name}
                    </span>
                    <div
                      className='w-8 h-2 rounded-full'
                      style={{ backgroundColor: thumb.color }}
                      title='进度条颜�?
                    />
                  </div>
                  {themeSettings.progressThumbPresetId === thumb.id && (
                    <div className='absolute top-2 right-2'>
                      <Check className='w-5 h-5 text-blue-600 dark:text-blue-400' />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 自定义图标URL输入 */}
        {themeSettings.progressThumbType === 'custom' && (
          <div className='space-y-3'>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
              自定义图标URL
            </label>
            <input
              type='text'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400'
              placeholder='例如: https://example.com/icon.png'
              value={themeSettings.progressThumbCustomUrl}
              onChange={(e) =>
                setThemeSettings((prev) => ({
                  ...prev,
                  progressThumbCustomUrl: e.target.value,
                }))
              }
            />
            <p className='text-xs text-gray-500 dark:text-gray-400'>
              支持 PNG、JPG、GIF、WebP 格式，建议尺�?              32x32px，图片URL必须可公开访问
            </p>
            {themeSettings.progressThumbCustomUrl && (
              <div className='mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg'>
                <p className='text-xs text-gray-600 dark:text-gray-400 mb-2'>
                  预览�?                </p>
                <img
                  src={themeSettings.progressThumbCustomUrl}
                  alt='自定义图标预�?
                  className='w-12 h-12 object-contain border border-gray-300 dark:border-gray-600 rounded'
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const parent = (e.target as HTMLImageElement).parentElement;
                    if (parent && !parent.querySelector('.error-msg')) {
                      const errorMsg = document.createElement('p');
                      errorMsg.className = 'text-xs text-red-500 error-msg';
                      errorMsg.textContent = '图片加载失败，请检查URL是否正确';
                      parent.appendChild(errorMsg);
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 保存按钮 */}
      <div className='flex justify-end'>
        <button
          onClick={handleSave}
          disabled={isLoading('saveThemeConfig')}
          className={
            isLoading('saveThemeConfig')
              ? buttonStyles.disabled
              : buttonStyles.success
          }
        >
          {isLoading('saveThemeConfig') ? '保存�?..' : '保存个性化配置'}
        </button>
      </div>

      {/* 弹窗 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

// 音乐配置组件（已停用�?// const MusicConfigComponent = (...) => { ... }

// 新增站点配置组件
const SiteConfigComponent = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [showEnableCommentsModal, setShowEnableCommentsModal] = useState(false);
  const [siteSettings, setSiteSettings] = useState<SiteConfig>({
    SiteName: '',
    Announcement: '',
    SearchDownstreamMaxPage: 1,
    SiteInterfaceCacheTime: 7200,
    DoubanProxyType: 'cmliussss-cdn-tencent',
    DoubanProxy: '',
    DoubanImageProxyType: 'cmliussss-cdn-tencent',
    DoubanImageProxy: '',
    DisableYellowFilter: false,
    FluidSearch: true,
    DanmakuSourceType: 'builtin',
    DanmakuApiBase: 'https://mtvpls-danmu.netlify.app/87654321',
    DanmakuApiToken: '87654321',
    DanmakuAutoLoadDefault: true,
    TMDBApiKey: '',
    TMDBProxy: '',
    TMDBReverseProxy: '',
    BannerDataSource: 'Douban',
    RecommendationDataSource: 'Mixed',
    PansouApiUrl: '',
    PansouUsername: '',
    PansouPassword: '',
    PansouKeywordBlocklist: '',
    MagnetProxy: '',
    MagnetMikanReverseProxy: '',
    MagnetDmhyReverseProxy: '',
    MagnetAcgripReverseProxy: '',
    EnableComments: false,
    EnableRegistration: false,
    RegistrationRequireTurnstile: false,
    LoginRequireTurnstile: false,
    TurnstileSiteKey: '',
    TurnstileSecretKey: '',
    DefaultUserTags: [],
    EnableOIDCLogin: false,
    EnableOIDCRegistration: false,
    OIDCIssuer: '',
    OIDCAuthorizationEndpoint: '',
    OIDCTokenEndpoint: '',
    OIDCUserInfoEndpoint: '',
    OIDCClientId: '',
    OIDCClientSecret: '',
    OIDCButtonText: '',
  });

  // 豆瓣数据源相关状�?  const [isDoubanDropdownOpen, setIsDoubanDropdownOpen] = useState(false);
  const [isDoubanImageProxyDropdownOpen, setIsDoubanImageProxyDropdownOpen] =
    useState(false);

  // 豆瓣数据源选项
  const doubanDataSourceOptions = [
    { value: 'direct', label: '直连（服务器直接请求豆瓣�? },
    { value: 'cors-proxy-zwei', label: 'Cors Proxy By Zwei' },
    {
      value: 'cmliussss-cdn-tencent',
      label: '豆瓣 CDN By CMLiussss（腾讯云�?,
    },
    { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云�? },
    { value: 'custom', label: '自定义代�? },
  ];

  // 豆瓣图片代理选项
  const doubanImageProxyTypeOptions = [
    { value: 'server', label: '服务器代理（由服务器代理请求豆瓣�? },
    {
      value: 'cmliussss-cdn-tencent',
      label: '豆瓣 CDN By CMLiussss（腾讯云�?,
    },
    { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云�? },
    { value: 'baidu', label: '百度图片代理' },
    { value: 'custom', label: '自定义代�? },
    {
      value: 'direct',
      label: '直连（浏览器直接请求豆瓣，可能需要浏览器插件才能正常显示�?,
    },
    {
      value: 'img3',
      label: '豆瓣官方精品 CDN（阿里云，可能需要浏览器插件才能正常显示�?,
    },
  ];

  // 获取感谢信息
  const getThanksInfo = (dataSource: string) => {
    switch (dataSource) {
      case 'cors-proxy-zwei':
        return {
          text: 'Thanks to @Zwei',
          url: 'https://github.com/bestzwei',
        };
      case 'cmliussss-cdn-tencent':
      case 'cmliussss-cdn-ali':
        return {
          text: 'Thanks to @CMLiussss',
          url: 'https://github.com/cmliu',
        };
      default:
        return null;
    }
  };

  useEffect(() => {
    if (config?.SiteConfig) {
      setSiteSettings({
        ...config.SiteConfig,
        DoubanProxyType:
          config.SiteConfig.DoubanProxyType || 'cmliussss-cdn-tencent',
        DoubanProxy: config.SiteConfig.DoubanProxy || '',
        DoubanImageProxyType:
          config.SiteConfig.DoubanImageProxyType || 'cmliussss-cdn-tencent',
        DoubanImageProxy: config.SiteConfig.DoubanImageProxy || '',
        DisableYellowFilter: config.SiteConfig.DisableYellowFilter || false,
        FluidSearch: config.SiteConfig.FluidSearch || true,
        DanmakuSourceType: config.SiteConfig.DanmakuSourceType || 'custom',
        DanmakuApiBase:
          config.SiteConfig.DanmakuApiBase || 'http://localhost:9321',
        DanmakuApiToken: config.SiteConfig.DanmakuApiToken || '87654321',
        DanmakuAutoLoadDefault:
          config.SiteConfig.DanmakuAutoLoadDefault !== false,
        TMDBApiKey: config.SiteConfig.TMDBApiKey || '',
        TMDBProxy: config.SiteConfig.TMDBProxy || '',
        TMDBReverseProxy: config.SiteConfig.TMDBReverseProxy || '',
        BannerDataSource: config.SiteConfig.BannerDataSource || 'Douban',
        RecommendationDataSource:
          config.SiteConfig.RecommendationDataSource || 'Mixed',
        PansouApiUrl: config.SiteConfig.PansouApiUrl || '',
        PansouUsername: config.SiteConfig.PansouUsername || '',
        PansouPassword: config.SiteConfig.PansouPassword || '',
        PansouKeywordBlocklist: config.SiteConfig.PansouKeywordBlocklist || '',
        MagnetProxy: config.SiteConfig.MagnetProxy || '',
        MagnetMikanReverseProxy:
          config.SiteConfig.MagnetMikanReverseProxy || '',
        MagnetDmhyReverseProxy: config.SiteConfig.MagnetDmhyReverseProxy || '',
        MagnetAcgripReverseProxy:
          config.SiteConfig.MagnetAcgripReverseProxy || '',
        EnableComments: config.SiteConfig.EnableComments || false,
      });
    }
  }, [config]);

  // 点击外部区域关闭下拉�?  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDoubanDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('[data-dropdown="douban-datasource"]')) {
          setIsDoubanDropdownOpen(false);
        }
      }
    };

    if (isDoubanDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDoubanDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDoubanImageProxyDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('[data-dropdown="douban-image-proxy"]')) {
          setIsDoubanImageProxyDropdownOpen(false);
        }
      }
    };

    if (isDoubanImageProxyDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDoubanImageProxyDropdownOpen]);

  // 处理豆瓣数据源变�?  const handleDoubanDataSourceChange = (value: string) => {
    setSiteSettings((prev) => ({
      ...prev,
      DoubanProxyType: value,
    }));
  };

  // 处理豆瓣图片代理变化
  const handleDoubanImageProxyChange = (value: string) => {
    setSiteSettings((prev) => ({
      ...prev,
      DoubanImageProxyType: value,
    }));
  };

  // 处理评论开关变�?  const handleCommentsToggle = (checked: boolean) => {
    if (checked) {
      // 如果要开启评论，弹出确认�?      setShowEnableCommentsModal(true);
    } else {
      // 直接关闭评论
      setSiteSettings((prev) => ({
        ...prev,
        EnableComments: false,
      }));
    }
  };

  // 确认开启评�?  const handleConfirmEnableComments = () => {
    setSiteSettings((prev) => ({
      ...prev,
      EnableComments: true,
    }));
    setShowEnableCommentsModal(false);
  };

  // 保存站点配置
  const handleSave = async () => {
    await withLoading('saveSiteConfig', async () => {
      try {
        const resp = await fetch('/api/admin/site', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...siteSettings }),
        });

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || `保存失败: ${resp.status}`);
        }

        showSuccess('保存成功, 请刷新页�?, showAlert);
        await refreshConfig();
      } catch (err) {
        showError(err instanceof Error ? err.message : '保存失败', showAlert);
        throw err;
      }
    });
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载�?..
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 站点名称 */}
      <div>
        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
          站点名称
        </label>
        <input
          type='text'
          value={siteSettings.SiteName}
          onChange={(e) =>
            setSiteSettings((prev) => ({ ...prev, SiteName: e.target.value }))
          }
          className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
        />
      </div>

      {/* 站点公告 */}
      <div>
        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
          站点公告
        </label>
        <textarea
          value={siteSettings.Announcement}
          onChange={(e) =>
            setSiteSettings((prev) => ({
              ...prev,
              Announcement: e.target.value,
            }))
          }
          rows={3}
          className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
        />
      </div>

      {/* 豆瓣数据源设�?*/}
      <div className='space-y-3'>
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            豆瓣数据代理
          </label>
          <div className='relative' data-dropdown='douban-datasource'>
            {/* 自定义下拉选择�?*/}
            <button
              type='button'
              onClick={() => setIsDoubanDropdownOpen(!isDoubanDropdownOpen)}
              className='w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm hover:border-gray-400 dark:hover:border-gray-500 text-left'
            >
              {
                doubanDataSourceOptions.find(
                  (option) => option.value === siteSettings.DoubanProxyType
                )?.label
              }
            </button>

            {/* 下拉箭头 */}
            <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
                  isDoubanDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </div>

            {/* 下拉选项列表 */}
            {isDoubanDropdownOpen && (
              <div className='absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto'>
                {doubanDataSourceOptions.map((option) => (
                  <button
                    key={option.value}
                    type='button'
                    onClick={() => {
                      handleDoubanDataSourceChange(option.value);
                      setIsDoubanDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      siteSettings.DoubanProxyType === option.value
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    <span className='truncate'>{option.label}</span>
                    {siteSettings.DoubanProxyType === option.value && (
                      <Check className='w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 ml-2' />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            选择获取豆瓣数据的方�?          </p>

          {/* 感谢信息 */}
          {getThanksInfo(siteSettings.DoubanProxyType) && (
            <div className='mt-3'>
              <button
                type='button'
                onClick={() =>
                  window.open(
                    getThanksInfo(siteSettings.DoubanProxyType)!.url,
                    '_blank'
                  )
                }
                className='flex items-center justify-center gap-1.5 w-full px-3 text-xs text-gray-500 dark:text-gray-400 cursor-pointer'
              >
                <span className='font-medium'>
                  {getThanksInfo(siteSettings.DoubanProxyType)!.text}
                </span>
                <ExternalLink className='w-3.5 opacity-70' />
              </button>
            </div>
          )}
        </div>

        {/* 豆瓣代理地址设置 - 仅在选择自定义代理时显示 */}
        {siteSettings.DoubanProxyType === 'custom' && (
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              豆瓣代理地址
            </label>
            <input
              type='text'
              placeholder='例如: https://proxy.example.com/fetch?url='
              value={siteSettings.DoubanProxy}
              onChange={(e) =>
                setSiteSettings((prev) => ({
                  ...prev,
                  DoubanProxy: e.target.value,
                }))
              }
              className='w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 shadow-sm hover:border-gray-400 dark:hover:border-gray-500'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              自定义代理服务器地址
            </p>
          </div>
        )}
      </div>

      {/* 豆瓣图片代理设置 */}
      <div className='space-y-3'>
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            豆瓣图片代理
          </label>
          <div className='relative' data-dropdown='douban-image-proxy'>
            {/* 自定义下拉选择�?*/}
            <button
              type='button'
              onClick={() =>
                setIsDoubanImageProxyDropdownOpen(
                  !isDoubanImageProxyDropdownOpen
                )
              }
              className='w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm hover:border-gray-400 dark:hover:border-gray-500 text-left'
            >
              {
                doubanImageProxyTypeOptions.find(
                  (option) => option.value === siteSettings.DoubanImageProxyType
                )?.label
              }
            </button>

            {/* 下拉箭头 */}
            <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
                  isDoubanImageProxyDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </div>

            {/* 下拉选项列表 */}
            {isDoubanImageProxyDropdownOpen && (
              <div className='absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto'>
                {doubanImageProxyTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type='button'
                    onClick={() => {
                      handleDoubanImageProxyChange(option.value);
                      setIsDoubanImageProxyDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      siteSettings.DoubanImageProxyType === option.value
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    <span className='truncate'>{option.label}</span>
                    {siteSettings.DoubanImageProxyType === option.value && (
                      <Check className='w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 ml-2' />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            选择获取豆瓣图片的方�?          </p>

          {/* 感谢信息 */}
          {getThanksInfo(siteSettings.DoubanImageProxyType) && (
            <div className='mt-3'>
              <button
                type='button'
                onClick={() =>
                  window.open(
                    getThanksInfo(siteSettings.DoubanImageProxyType)!.url,
                    '_blank'
                  )
                }
                className='flex items-center justify-center gap-1.5 w-full px-3 text-xs text-gray-500 dark:text-gray-400 cursor-pointer'
              >
                <span className='font-medium'>
                  {getThanksInfo(siteSettings.DoubanImageProxyType)!.text}
                </span>
                <ExternalLink className='w-3.5 opacity-70' />
              </button>
            </div>
          )}
        </div>

        {/* 豆瓣代理地址设置 - 仅在选择自定义代理时显示 */}
        {siteSettings.DoubanImageProxyType === 'custom' && (
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              豆瓣图片代理地址
            </label>
            <input
              type='text'
              placeholder='例如: https://proxy.example.com/fetch?url='
              value={siteSettings.DoubanImageProxy}
              onChange={(e) =>
                setSiteSettings((prev) => ({
                  ...prev,
                  DoubanImageProxy: e.target.value,
                }))
              }
              className='w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 shadow-sm hover:border-gray-400 dark:hover:border-gray-500'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              自定义图片代理服务器地址
            </p>
          </div>
        )}
      </div>

      {/* 搜索接口可拉取最大页�?*/}
      <div>
        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
          搜索接口可拉取最大页�?        </label>
        <input
          type='number'
          min={1}
          value={siteSettings.SearchDownstreamMaxPage}
          onChange={(e) =>
            setSiteSettings((prev) => ({
              ...prev,
              SearchDownstreamMaxPage: Number(e.target.value),
            }))
          }
          className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
        />
      </div>

      {/* 站点接口缓存时间 */}
      <div>
        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
          站点接口缓存时间（秒�?        </label>
        <input
          type='number'
          min={1}
          value={siteSettings.SiteInterfaceCacheTime}
          onChange={(e) =>
            setSiteSettings((prev) => ({
              ...prev,
              SiteInterfaceCacheTime: Number(e.target.value),
            }))
          }
          className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
        />
      </div>

      {/* 禁用黄色过滤�?*/}
      <div>
        <div className='flex items-center justify-between'>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            禁用黄色过滤�?          </label>
          <button
            type='button'
            onClick={() =>
              setSiteSettings((prev) => ({
                ...prev,
                DisableYellowFilter: !prev.DisableYellowFilter,
              }))
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
              siteSettings.DisableYellowFilter
                ? buttonStyles.toggleOn
                : buttonStyles.toggleOff
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full ${
                buttonStyles.toggleThumb
              } transition-transform ${
                siteSettings.DisableYellowFilter
                  ? buttonStyles.toggleThumbOn
                  : buttonStyles.toggleThumbOff
              }`}
            />
          </button>
        </div>
        <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
          禁用黄色内容的过滤功能，允许显示所有内容�?        </p>
      </div>

      {/* 流式搜索 */}
      <div>
        <div className='flex items-center justify-between'>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            启用流式搜索
          </label>
          <button
            type='button'
            onClick={() =>
              setSiteSettings((prev) => ({
                ...prev,
                FluidSearch: !prev.FluidSearch,
              }))
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
              siteSettings.FluidSearch
                ? buttonStyles.toggleOn
                : buttonStyles.toggleOff
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full ${
                buttonStyles.toggleThumb
              } transition-transform ${
                siteSettings.FluidSearch
                  ? buttonStyles.toggleThumbOn
                  : buttonStyles.toggleThumbOff
              }`}
            />
          </button>
        </div>
        <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
          启用后搜索结果将实时流式返回,提升用户体验�?        </p>
      </div>

      <details className='pt-4 border-t border-gray-200 dark:border-gray-700'>
        <summary className='text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer'>
          数据源配�?        </summary>
        <div className='mt-4 space-y-4'>
          {/* 轮播图数据源 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              轮播图数据源
            </label>
            <select
              value={siteSettings.BannerDataSource || 'Douban'}
              onChange={(e) =>
                setSiteSettings((prev) => ({
                  ...prev,
                  BannerDataSource: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            >
              <option value='Douban'>豆瓣</option>
              <option value='TMDB'>TMDB</option>
              <option value='TX'>TX</option>
            </select>
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              选择首页轮播图的数据来源
            </p>
          </div>

          {/* 更多推荐数据�?*/}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              更多推荐数据�?            </label>
            <select
              value={siteSettings.RecommendationDataSource || 'Mixed'}
              onChange={(e) =>
                setSiteSettings((prev) => ({
                  ...prev,
                  RecommendationDataSource: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            >
              <option value='Mixed'>混合</option>
              <option value='Douban'>豆瓣</option>
              <option value='TMDB'>TMDB</option>
            </select>
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              选择详情�?更多推荐"的数据来源。混合模式会根据豆瓣ID和评论开关自动切换数据源
            </p>
          </div>
        </div>
      </details>

      {/* 弹幕 API 配置 */}
      <details className='pt-4 border-t border-gray-200 dark:border-gray-700'>
        <summary className='text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer'>
          弹幕配置
        </summary>
        <div className='mt-4 space-y-4'>
          <div className='inline-flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800'>
            <button
              type='button'
              onClick={() =>
                setSiteSettings((prev) => ({
                  ...prev,
                  DanmakuSourceType: 'builtin',
                }))
              }
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                siteSettings.DanmakuSourceType !== 'custom'
                  ? 'bg-white text-green-600 shadow-sm dark:bg-gray-700 dark:text-green-400'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
              }`}
            >
              内置�?            </button>
            <button
              type='button'
              onClick={() =>
                setSiteSettings((prev) => ({
                  ...prev,
                  DanmakuSourceType: 'custom',
                }))
              }
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                siteSettings.DanmakuSourceType === 'custom'
                  ? 'bg-white text-green-600 shadow-sm dark:bg-gray-700 dark:text-green-400'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
              }`}
            >
              自定义源
            </button>
          </div>

          {siteSettings.DanmakuSourceType !== 'custom' && (
            <p className='text-xs text-amber-600 dark:text-amber-400'>
              ⚠️
              内置弹幕源为多人共享服务，稳定性可能受使用高峰影响，建议自行部署后使用自定义源�?            </p>
          )}

          {siteSettings.DanmakuSourceType === 'custom' && (
            <>
              {/* 弹幕 API 地址 */}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  弹幕 API 地址
                </label>
                <input
                  type='text'
                  placeholder='http://localhost:9321'
                  value={siteSettings.DanmakuApiBase}
                  onChange={(e) =>
                    setSiteSettings((prev) => ({
                      ...prev,
                      DanmakuApiBase: e.target.value,
                    }))
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
                />
                <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                  自定义弹幕服务器�?API 地址。API部署参�?                  <a
                    href='https://github.com/huangxd-/danmu_api.git'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='ml-1 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300'
                  >
                    danmu_api
                  </a>
                </p>
              </div>

              {/* 弹幕 API Token */}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  弹幕 API Token
                </label>
                <input
                  type='text'
                  placeholder='87654321'
                  value={siteSettings.DanmakuApiToken}
                  onChange={(e) =>
                    setSiteSettings((prev) => ({
                      ...prev,
                      DanmakuApiToken: e.target.value,
                    }))
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
                />
                <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                  自定义弹幕服务器的访问令牌，默认�?87654321
                </p>
              </div>
            </>
          )}

          <div className='flex items-center justify-between'>
            <div>
              <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                默认自动加载弹幕
              </h4>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                新用户或未设置本地偏好时，播放页是否默认自动匹配并加载弹幕。用户仍可在个人设置中自行覆盖�?              </p>
            </div>
            <label className='flex items-center cursor-pointer'>
              <div className='relative'>
                <input
                  type='checkbox'
                  className='sr-only peer'
                  checked={siteSettings.DanmakuAutoLoadDefault !== false}
                  onChange={(e) =>
                    setSiteSettings((prev) => ({
                      ...prev,
                      DanmakuAutoLoadDefault: e.target.checked,
                    }))
                  }
                />
                <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
              </div>
            </label>
          </div>
        </div>
      </details>

      {/* TMDB 配置 */}
      <details className='pt-4 border-t border-gray-200 dark:border-gray-700'>
        <summary className='text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer'>
          TMDB 配置
        </summary>
        <div className='mt-4 space-y-4'>
          <p className='text-xs text-amber-600 dark:text-amber-400'>
            由于国内网络环境限制，TMDB 服务通常需要配置代理后才能正常使用�?          </p>
          {/* TMDB API Key */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              TMDB API Key
            </label>
            <input
              type='text'
              placeholder='请输�?TMDB API Key（多个key用英文逗号分隔�?
              value={siteSettings.TMDBApiKey}
              onChange={(e) =>
                setSiteSettings((prev) => ({
                  ...prev,
                  TMDBApiKey: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              配置后首页将显示 TMDB 即将上映电影。支持配置多�?API
              Key（用英文逗号分隔）以实现轮询，避免单�?Key 请求限制。获�?API
              Key 请访问{' '}
              <a
                href='https://www.themoviedb.org/settings/api'
                target='_blank'
                rel='noopener noreferrer'
                className='text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300'
              >
                TMDB API 设置页面
              </a>
            </p>
          </div>

          {/* TMDB Proxy */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              TMDB 系统代理
            </label>
            <input
              type='text'
              placeholder='请输入代理地址（可选）'
              value={siteSettings.TMDBProxy}
              onChange={(e) =>
                setSiteSettings((prev) => ({
                  ...prev,
                  TMDBProxy: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              配置代理服务器地址，用于访�?TMDB API（可选）
            </p>
          </div>

          {/* TMDB Reverse Proxy */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              TMDB 反代代理
            </label>
            <input
              type='text'
              placeholder='请输入反�?Base URL（可选）'
              value={siteSettings.TMDBReverseProxy}
              onChange={(e) =>
                setSiteSettings((prev) => ({
                  ...prev,
                  TMDBReverseProxy: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              配置 TMDB 反向代理 Base URL（可选）
            </p>
          </div>
        </div>
      </details>

      <details className='pt-4 border-t border-gray-200 dark:border-gray-700'>
        <summary className='text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer'>
          磁链配置
        </summary>
        <div className='mt-4 space-y-4'>
          <p className='text-xs text-amber-600 dark:text-amber-400'>
            由于国内网络环境限制，部分磁链搜索站点通常需要配置代理后才能正常访问�?          </p>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              系统代理
            </label>
            <input
              type='text'
              placeholder='请输入代理地址（可选）'
              value={siteSettings.MagnetProxy || ''}
              onChange={(e) =>
                setSiteSettings((prev) => ({
                  ...prev,
                  MagnetProxy: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              用于访问磁链搜索站点的系统代理。Cloudflare
              部署环境下不会使用该代理�?            </p>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              Mikan 反代代理
            </label>
            <input
              type='text'
              placeholder='请输�?Mikan 反代 Base URL（可选）'
              value={siteSettings.MagnetMikanReverseProxy || ''}
              onChange={(e) =>
                setSiteSettings((prev) => ({
                  ...prev,
                  MagnetMikanReverseProxy: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              配置后将使用该地址替代默认�?Mikan 域名进行请求�?            </p>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              动漫花园反代代理
            </label>
            <input
              type='text'
              placeholder='请输入动漫花园反�?Base URL（可选）'
              value={siteSettings.MagnetDmhyReverseProxy || ''}
              onChange={(e) =>
                setSiteSettings((prev) => ({
                  ...prev,
                  MagnetDmhyReverseProxy: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              配置后将使用该地址替代默认的动漫花园域名进行请求�?            </p>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              ACG.RIP 反代代理
            </label>
            <input
              type='text'
              placeholder='请输�?ACG.RIP 反代 Base URL（可选）'
              value={siteSettings.MagnetAcgripReverseProxy || ''}
              onChange={(e) =>
                setSiteSettings((prev) => ({
                  ...prev,
                  MagnetAcgripReverseProxy: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              配置后将使用该地址替代默认�?ACG.RIP 域名进行请求�?            </p>
          </div>
        </div>
      </details>

      {/* Pansou 配置 */}
      <details className='pt-4 border-t border-gray-200 dark:border-gray-700'>
        <summary className='text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer'>
          Pansou 网盘搜索配置
        </summary>
        <div className='mt-4 space-y-4'>
          {/* Pansou API 地址 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              Pansou API 地址
            </label>
            <input
              type='text'
              placeholder='请输�?Pansou API 地址，如：http://localhost:8888'
              value={siteSettings.PansouApiUrl}
              onChange={(e) =>
                setSiteSettings((prev) => ({
                  ...prev,
                  PansouApiUrl: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              配置 Pansou 服务器地址，用于网盘资源搜索。项目地址：{' '}
              <a
                href='https://github.com/fish2018/pansou'
                target='_blank'
                rel='noopener noreferrer'
                className='text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300'
              >
                https://github.com/fish2018/pansou
              </a>
            </p>
          </div>

          {/* Pansou 账号 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              Pansou 账号（可选）
            </label>
            <input
              type='text'
              placeholder='如果 Pansou 启用了认证，请输入账�?
              value={siteSettings.PansouUsername}
              onChange={(e) =>
                setSiteSettings((prev) => ({
                  ...prev,
                  PansouUsername: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              如果 Pansou 服务启用了认证功能，需要提供账号密�?            </p>
          </div>

          {/* Pansou 密码 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              Pansou 密码（可选）
            </label>
            <input
              type='password'
              placeholder='如果 Pansou 启用了认证，请输入密�?
              value={siteSettings.PansouPassword}
              onChange={(e) =>
                setSiteSettings((prev) => ({
                  ...prev,
                  PansouPassword: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              配置账号密码后，系统会自动登录并缓存 Token
            </p>
          </div>

          {/* 关键词屏�?*/}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              关键词屏蔽（可选）
            </label>
            <input
              type='text'
              placeholder='多个关键词用中文或英文逗号分隔'
              value={siteSettings.PansouKeywordBlocklist}
              onChange={(e) =>
                setSiteSettings((prev) => ({
                  ...prev,
                  PansouKeywordBlocklist: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              设置后会过滤包含这些关键词的搜索结果
            </p>
          </div>
        </div>
      </details>

      {/* 评论功能配置 */}
      <details className='pt-4 border-t border-gray-200 dark:border-gray-700'>
        <summary className='text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer'>
          评论配置
        </summary>
        <div className='mt-4 space-y-4'>
          {/* 开启评论与相似推荐 */}
          <div>
            <div className='flex items-center justify-between'>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                开启评论与相似推荐
              </label>
              <button
                type='button'
                onClick={() =>
                  handleCommentsToggle(!siteSettings.EnableComments)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                  siteSettings.EnableComments
                    ? buttonStyles.toggleOn
                    : buttonStyles.toggleOff
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full ${
                    buttonStyles.toggleThumb
                  } transition-transform ${
                    siteSettings.EnableComments
                      ? buttonStyles.toggleThumbOn
                      : buttonStyles.toggleThumbOff
                  }`}
                />
              </button>
            </div>
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              开启后将显示豆瓣评论与相似推荐。评论为逆向抓取，请自行承担责任�?            </p>
          </div>
        </div>
      </details>

      {/* 操作按钮 */}
      <div className='flex justify-end'>
        <button
          onClick={handleSave}
          disabled={isLoading('saveSiteConfig')}
          className={`px-4 py-2 ${
            isLoading('saveSiteConfig')
              ? buttonStyles.disabled
              : buttonStyles.success
          } rounded-lg transition-colors`}
        >
          {isLoading('saveSiteConfig') ? '保存中�? : '保存'}
        </button>
      </div>

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />

      {/* 开启评论确认弹�?*/}
      {showEnableCommentsModal &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => setShowEnableCommentsModal(false)}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    开启评论与相似推荐功能
                  </h3>
                  <button
                    onClick={() => setShowEnableCommentsModal(false)}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='mb-6'>
                  <div className='bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4'>
                    <div className='flex items-center space-x-2 mb-2'>
                      <AlertTriangle className='w-5 h-5 text-yellow-600 dark:text-yellow-400' />
                      <span className='text-sm font-medium text-yellow-800 dark:text-yellow-300'>
                        重要提示
                      </span>
                    </div>
                    <p className='text-sm text-yellow-700 dark:text-yellow-400'>
                      评论功能为逆向抓取豆瓣评论数据，此功能仅供学习，开启后请自行承担相关责任和风险�?                    </p>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={() => setShowEnableCommentsModal(false)}
                    className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.secondary}`}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmEnableComments}
                    className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.primary}`}
                  >
                    我已知晓，确认开�?                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

// 注册配置组件
const RegistrationConfigComponent = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [showEnableRegistrationModal, setShowEnableRegistrationModal] =
    useState(false);
  const [registrationSettings, setRegistrationSettings] = useState<{
    EnableRegistration: boolean;
    RequireRegistrationInviteCode: boolean;
    RegistrationInviteCode: string;
    RegistrationRequireTurnstile: boolean;
    LoginRequireTurnstile: boolean;
    TurnstileSiteKey: string;
    TurnstileSecretKey: string;
    DefaultUserTags: string[];
    EnableOIDCLogin: boolean;
    EnableOIDCRegistration: boolean;
    OIDCIssuer: string;
    OIDCAuthorizationEndpoint: string;
    OIDCTokenEndpoint: string;
    OIDCUserInfoEndpoint: string;
    OIDCClientId: string;
    OIDCClientSecret: string;
    OIDCButtonText: string;
    OIDCMinTrustLevel: number;
  }>({
    EnableRegistration: false,
    RequireRegistrationInviteCode: false,
    RegistrationInviteCode: '',
    RegistrationRequireTurnstile: false,
    LoginRequireTurnstile: false,
    TurnstileSiteKey: '',
    TurnstileSecretKey: '',
    DefaultUserTags: [],
    EnableOIDCLogin: false,
    EnableOIDCRegistration: false,
    OIDCIssuer: '',
    OIDCAuthorizationEndpoint: '',
    OIDCTokenEndpoint: '',
    OIDCUserInfoEndpoint: '',
    OIDCClientId: '',
    OIDCClientSecret: '',
    OIDCButtonText: '',
    OIDCMinTrustLevel: 0,
  });

  useEffect(() => {
    if (config?.SiteConfig) {
      setRegistrationSettings({
        EnableRegistration: config.SiteConfig.EnableRegistration || false,
        RequireRegistrationInviteCode:
          config.SiteConfig.RequireRegistrationInviteCode || false,
        RegistrationInviteCode: config.SiteConfig.RegistrationInviteCode || '',
        RegistrationRequireTurnstile:
          config.SiteConfig.RegistrationRequireTurnstile || false,
        LoginRequireTurnstile: config.SiteConfig.LoginRequireTurnstile || false,
        TurnstileSiteKey: config.SiteConfig.TurnstileSiteKey || '',
        TurnstileSecretKey: config.SiteConfig.TurnstileSecretKey || '',
        DefaultUserTags: config.SiteConfig.DefaultUserTags || [],
        EnableOIDCLogin: config.SiteConfig.EnableOIDCLogin || false,
        EnableOIDCRegistration:
          config.SiteConfig.EnableOIDCRegistration || false,
        OIDCIssuer: config.SiteConfig.OIDCIssuer || '',
        OIDCAuthorizationEndpoint:
          config.SiteConfig.OIDCAuthorizationEndpoint || '',
        OIDCTokenEndpoint: config.SiteConfig.OIDCTokenEndpoint || '',
        OIDCUserInfoEndpoint: config.SiteConfig.OIDCUserInfoEndpoint || '',
        OIDCClientId: config.SiteConfig.OIDCClientId || '',
        OIDCClientSecret: config.SiteConfig.OIDCClientSecret || '',
        OIDCButtonText: config.SiteConfig.OIDCButtonText || '',
        OIDCMinTrustLevel: config.SiteConfig.OIDCMinTrustLevel ?? 0,
      });
    }
  }, [config]);

  // 处理注册开关变�?  const handleRegistrationToggle = (checked: boolean) => {
    if (checked) {
      setShowEnableRegistrationModal(true);
    } else {
      setRegistrationSettings((prev) => ({
        ...prev,
        EnableRegistration: false,
      }));
    }
  };

  // 确认开启注�?  const handleConfirmEnableRegistration = () => {
    setRegistrationSettings((prev) => ({
      ...prev,
      EnableRegistration: true,
    }));
    setShowEnableRegistrationModal(false);
  };

  // 保存注册配置
  const handleSave = async () => {
    await withLoading('saveRegistrationConfig', async () => {
      try {
        if (!config) {
          throw new Error('配置未加�?);
        }

        if (
          registrationSettings.RequireRegistrationInviteCode &&
          !registrationSettings.RegistrationInviteCode.trim()
        ) {
          throw new Error('已开启注册邀请码时，邀请码不能为空');
        }

        // 合并站点配置和注册配�?        const updatedSiteConfig = {
          ...config.SiteConfig,
          ...registrationSettings,
          RegistrationInviteCode:
            registrationSettings.RegistrationInviteCode.trim(),
        };

        const resp = await fetch('/api/admin/site', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedSiteConfig),
        });

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || `保存失败: ${resp.status}`);
        }

        showSuccess('保存成功, 请刷新页�?, showAlert);
        await refreshConfig();
      } catch (err) {
        showError(err instanceof Error ? err.message : '保存失败', showAlert);
        throw err;
      }
    });
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载�?..
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 注册相关配置 */}
      <div className='space-y-4'>
        <h3 className='text-sm font-semibold text-gray-900 dark:text-gray-100'>
          注册配置
        </h3>

        <details
          open
          className='pt-4 border-t border-gray-200 dark:border-gray-700'
        >
          <summary className='text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer'>
            基础注册设置
          </summary>
          <div className='mt-4 space-y-4'>
            <div>
              <div className='flex items-center justify-between'>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  开启注�?                </label>
                <button
                  type='button'
                  onClick={() =>
                    handleRegistrationToggle(
                      !registrationSettings.EnableRegistration
                    )
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                    registrationSettings.EnableRegistration
                      ? buttonStyles.toggleOn
                      : buttonStyles.toggleOff
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full ${
                      buttonStyles.toggleThumb
                    } transition-transform ${
                      registrationSettings.EnableRegistration
                        ? buttonStyles.toggleThumbOn
                        : buttonStyles.toggleThumbOff
                    }`}
                  />
                </button>
              </div>
              <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                开启后登录页面将显示注册按钮，允许用户自行注册账号�?              </p>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                默认用户�?              </label>
              <select
                value={
                  registrationSettings.DefaultUserTags &&
                  registrationSettings.DefaultUserTags.length > 0
                    ? registrationSettings.DefaultUserTags[0]
                    : ''
                }
                onChange={(e) => {
                  const value = e.target.value;
                  setRegistrationSettings((prev) => ({
                    ...prev,
                    DefaultUserTags: value ? [value] : [],
                  }));
                }}
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
              >
                <option value=''>无用户组（无限制�?/option>
                {config?.UserConfig?.Tags &&
                  config.UserConfig.Tags.map((tag) => (
                    <option key={tag.name} value={tag.name}>
                      {tag.name}
                      {tag.enabledApis && tag.enabledApis.length > 0
                        ? ` (${tag.enabledApis.length} 个源)`
                        : ''}
                    </option>
                  ))}
              </select>
              <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                新注册的用户将自动分配到选中的用户组，选择"无用户组"为无限制
              </p>
            </div>
          </div>
        </details>

        <details className='pt-4 border-t border-gray-200 dark:border-gray-700'>
          <summary className='text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer'>
            安全设置
          </summary>
          <div className='mt-4 space-y-4'>
            <div>
              <div className='flex items-center justify-between'>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  要求注册邀请码
                </label>
                <button
                  type='button'
                  onClick={() =>
                    setRegistrationSettings((prev) => ({
                      ...prev,
                      RequireRegistrationInviteCode:
                        !prev.RequireRegistrationInviteCode,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                    registrationSettings.RequireRegistrationInviteCode
                      ? buttonStyles.toggleOn
                      : buttonStyles.toggleOff
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full ${
                      buttonStyles.toggleThumb
                    } transition-transform ${
                      registrationSettings.RequireRegistrationInviteCode
                        ? buttonStyles.toggleThumbOn
                        : buttonStyles.toggleThumbOff
                    }`}
                  />
                </button>
              </div>
              <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                开启后，普通注册必须填写管理员设置的统一邀请码�?              </p>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                通用注册邀请码
              </label>
              <input
                type='text'
                placeholder='请输入通用注册邀请码'
                value={registrationSettings.RegistrationInviteCode || ''}
                onChange={(e) =>
                  setRegistrationSettings((prev) => ({
                    ...prev,
                    RegistrationInviteCode: e.target.value,
                  }))
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
              />
              <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                仅普通注册生效；开启邀请码注册时不能为空�?              </p>
            </div>

            <div>
              <div className='flex items-center justify-between'>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  注册启用Cloudflare Turnstile
                </label>
                <button
                  type='button'
                  disabled={
                    !registrationSettings.TurnstileSiteKey ||
                    !registrationSettings.TurnstileSecretKey
                  }
                  onClick={() =>
                    setRegistrationSettings((prev) => ({
                      ...prev,
                      RegistrationRequireTurnstile:
                        !prev.RegistrationRequireTurnstile,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                    !registrationSettings.TurnstileSiteKey ||
                    !registrationSettings.TurnstileSecretKey
                      ? 'opacity-50 cursor-not-allowed bg-gray-300 dark:bg-gray-600'
                      : registrationSettings.RegistrationRequireTurnstile
                      ? buttonStyles.toggleOn
                      : buttonStyles.toggleOff
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full ${
                      buttonStyles.toggleThumb
                    } transition-transform ${
                      registrationSettings.RegistrationRequireTurnstile
                        ? buttonStyles.toggleThumbOn
                        : buttonStyles.toggleThumbOff
                    }`}
                  />
                </button>
              </div>
              <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                开启后注册时需要通过Cloudflare Turnstile人机验证�?                {(!registrationSettings.TurnstileSiteKey ||
                  !registrationSettings.TurnstileSecretKey) && (
                  <span className='text-orange-500 dark:text-orange-400'>
                    {' '}
                    需要先配置Site Key和Secret Key才能启用�?                  </span>
                )}
              </p>
            </div>

            <div>
              <div className='flex items-center justify-between'>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  登录启用Cloudflare Turnstile
                </label>
                <button
                  type='button'
                  disabled={
                    !registrationSettings.TurnstileSiteKey ||
                    !registrationSettings.TurnstileSecretKey
                  }
                  onClick={() =>
                    setRegistrationSettings((prev) => ({
                      ...prev,
                      LoginRequireTurnstile: !prev.LoginRequireTurnstile,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                    !registrationSettings.TurnstileSiteKey ||
                    !registrationSettings.TurnstileSecretKey
                      ? 'opacity-50 cursor-not-allowed bg-gray-300 dark:bg-gray-600'
                      : registrationSettings.LoginRequireTurnstile
                      ? buttonStyles.toggleOn
                      : buttonStyles.toggleOff
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full ${
                      buttonStyles.toggleThumb
                    } transition-transform ${
                      registrationSettings.LoginRequireTurnstile
                        ? buttonStyles.toggleThumbOn
                        : buttonStyles.toggleThumbOff
                    }`}
                  />
                </button>
              </div>
              <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                开启后登录时需要通过Cloudflare Turnstile人机验证�?                {(!registrationSettings.TurnstileSiteKey ||
                  !registrationSettings.TurnstileSecretKey) && (
                  <span className='text-orange-500 dark:text-orange-400'>
                    {' '}
                    需要先配置Site Key和Secret Key才能启用�?                  </span>
                )}
              </p>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                Cloudflare Turnstile Site Key
              </label>
              <input
                type='text'
                placeholder='请输入Cloudflare Turnstile Site Key'
                value={registrationSettings.TurnstileSiteKey || ''}
                onChange={(e) =>
                  setRegistrationSettings((prev) => ({
                    ...prev,
                    TurnstileSiteKey: e.target.value,
                  }))
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
              />
              <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                在Cloudflare Dashboard中获取的Site Key（公钥）
              </p>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                Cloudflare Turnstile Secret Key
              </label>
              <input
                type='password'
                placeholder='请输入Cloudflare Turnstile Secret Key'
                value={registrationSettings.TurnstileSecretKey || ''}
                onChange={(e) =>
                  setRegistrationSettings((prev) => ({
                    ...prev,
                    TurnstileSecretKey: e.target.value,
                  }))
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
              />
              <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                在Cloudflare Dashboard中获取的Secret Key（私钥），用于服务端验证
              </p>
            </div>
          </div>
        </details>
      </div>

      {/* OIDC配置 */}
      <details className='pt-4 border-t border-gray-200 dark:border-gray-700'>
        <summary className='text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer'>
          OIDC配置
        </summary>
        <div className='mt-4 space-y-4'>
          {/* 启用OIDC登录 */}
          <div>
            <div className='flex items-center justify-between'>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                启用OIDC登录
              </label>
              <button
                type='button'
                onClick={() =>
                  setRegistrationSettings((prev) => ({
                    ...prev,
                    EnableOIDCLogin: !prev.EnableOIDCLogin,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                  registrationSettings.EnableOIDCLogin
                    ? buttonStyles.toggleOn
                    : buttonStyles.toggleOff
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full ${
                    buttonStyles.toggleThumb
                  } transition-transform ${
                    registrationSettings.EnableOIDCLogin
                      ? buttonStyles.toggleThumbOn
                      : buttonStyles.toggleThumbOff
                  }`}
                />
              </button>
            </div>
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              开启后登录页面将显示OIDC登录按钮
            </p>
          </div>

          {/* 启用OIDC注册 */}
          <div>
            <div className='flex items-center justify-between'>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                启用OIDC注册
              </label>
              <button
                type='button'
                onClick={() =>
                  setRegistrationSettings((prev) => ({
                    ...prev,
                    EnableOIDCRegistration: !prev.EnableOIDCRegistration,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                  registrationSettings.EnableOIDCRegistration
                    ? buttonStyles.toggleOn
                    : buttonStyles.toggleOff
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full ${
                    buttonStyles.toggleThumb
                  } transition-transform ${
                    registrationSettings.EnableOIDCRegistration
                      ? buttonStyles.toggleThumbOn
                      : buttonStyles.toggleThumbOff
                  }`}
                />
              </button>
            </div>
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              开启后允许通过OIDC方式注册新用户（需要先启用OIDC登录�?            </p>
          </div>

          {/* OIDC Issuer */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              OIDC Issuer URL（可选）
            </label>
            <div className='flex flex-col sm:flex-row gap-2'>
              <input
                type='text'
                placeholder='https://your-oidc-provider.com/realms/your-realm'
                value={registrationSettings.OIDCIssuer || ''}
                onChange={(e) =>
                  setRegistrationSettings((prev) => ({
                    ...prev,
                    OIDCIssuer: e.target.value,
                  }))
                }
                className='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
              />
              <button
                type='button'
                onClick={async () => {
                  if (!registrationSettings.OIDCIssuer) {
                    showError('请先输入Issuer URL', showAlert);
                    return;
                  }

                  await withLoading('oidcDiscover', async () => {
                    try {
                      const res = await fetch('/api/admin/oidc-discover', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          issuerUrl: registrationSettings.OIDCIssuer,
                        }),
                      });

                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data.error || '获取配置失败');
                      }

                      const data = await res.json();
                      setRegistrationSettings((prev) => ({
                        ...prev,
                        OIDCAuthorizationEndpoint:
                          data.authorization_endpoint || '',
                        OIDCTokenEndpoint: data.token_endpoint || '',
                        OIDCUserInfoEndpoint: data.userinfo_endpoint || '',
                      }));
                      showSuccess('自动发现成功', showAlert);
                    } catch (error) {
                      const errorMessage =
                        error instanceof Error
                          ? error.message
                          : '自动发现失败，请手动配置端点';
                      showError(errorMessage, showAlert);
                      throw error;
                    }
                  });
                }}
                disabled={isLoading('oidcDiscover')}
                className={`px-4 py-2 ${
                  isLoading('oidcDiscover')
                    ? buttonStyles.disabled
                    : buttonStyles.primary
                } rounded-lg whitespace-nowrap sm:w-auto w-full`}
              >
                {isLoading('oidcDiscover') ? '发现�?..' : '自动发现'}
              </button>
            </div>
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              OIDC提供商的Issuer URL，填写后可点�?自动发现"按钮自动获取端点配置
            </p>
          </div>

          {/* Authorization Endpoint */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              Authorization Endpoint（授权端点）
            </label>
            <input
              type='text'
              placeholder='https://your-oidc-provider.com/realms/your-realm/protocol/openid-connect/auth'
              value={registrationSettings.OIDCAuthorizationEndpoint || ''}
              onChange={(e) =>
                setRegistrationSettings((prev) => ({
                  ...prev,
                  OIDCAuthorizationEndpoint: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              用户授权的端点URL
            </p>
          </div>

          {/* Token Endpoint */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              Token Endpoint（Token端点�?            </label>
            <input
              type='text'
              placeholder='https://your-oidc-provider.com/realms/your-realm/protocol/openid-connect/token'
              value={registrationSettings.OIDCTokenEndpoint || ''}
              onChange={(e) =>
                setRegistrationSettings((prev) => ({
                  ...prev,
                  OIDCTokenEndpoint: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              交换授权码获取token的端点URL
            </p>
          </div>

          {/* UserInfo Endpoint */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              UserInfo Endpoint（用户信息端点）
            </label>
            <input
              type='text'
              placeholder='https://your-oidc-provider.com/realms/your-realm/protocol/openid-connect/userinfo'
              value={registrationSettings.OIDCUserInfoEndpoint || ''}
              onChange={(e) =>
                setRegistrationSettings((prev) => ({
                  ...prev,
                  OIDCUserInfoEndpoint: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              获取用户信息的端点URL
            </p>
          </div>

          {/* OIDC Client ID */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              OIDC Client ID
            </label>
            <input
              type='text'
              placeholder='请输入Client ID'
              value={registrationSettings.OIDCClientId || ''}
              onChange={(e) =>
                setRegistrationSettings((prev) => ({
                  ...prev,
                  OIDCClientId: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              在OIDC提供商处注册应用后获得的Client ID
            </p>
          </div>

          {/* OIDC Client Secret */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              OIDC Client Secret
            </label>
            <input
              type='password'
              placeholder='请输入Client Secret'
              value={registrationSettings.OIDCClientSecret || ''}
              onChange={(e) =>
                setRegistrationSettings((prev) => ({
                  ...prev,
                  OIDCClientSecret: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              在OIDC提供商处注册应用后获得的Client Secret
            </p>
          </div>

          {/* OIDC Redirect URI - 只读显示 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              OIDC Redirect URI（回调地址�?            </label>
            <div className='relative'>
              <input
                type='text'
                readOnly
                value={
                  typeof window !== 'undefined'
                    ? `${
                        (window as any).RUNTIME_CONFIG?.SITE_BASE ||
                        window.location.origin
                      }/api/auth/oidc/callback`
                    : ''
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 cursor-default'
              />
              <button
                type='button'
                onClick={() => {
                  const uri = `${
                    (window as any).RUNTIME_CONFIG?.SITE_BASE ||
                    window.location.origin
                  }/api/auth/oidc/callback`;
                  navigator.clipboard.writeText(uri);
                  showSuccess('已复制到剪贴�?, showAlert);
                }}
                className='absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors'
              >
                复制
              </button>
            </div>
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              这是系统自动生成的回调地址，基于环境变量SITE_BASE。请在OIDC提供商（如Keycloak、Auth0等）的应用配置中添加此地址作为允许的重定向URI
            </p>
          </div>

          {/* OIDC登录按钮文字 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              OIDC登录按钮文字
            </label>
            <input
              type='text'
              placeholder='使用OIDC登录'
              value={registrationSettings.OIDCButtonText || ''}
              onChange={(e) =>
                setRegistrationSettings((prev) => ({
                  ...prev,
                  OIDCButtonText: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              自定义OIDC登录按钮显示的文�?�?使用企业账号登录"�?使用SSO登录"等。留空则显示默认文字"使用OIDC登录"
            </p>
          </div>

          {/* OIDC最低信任等�?*/}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              最低信任等�?            </label>
            <input
              type='number'
              min='0'
              max='4'
              placeholder='0'
              value={
                registrationSettings.OIDCMinTrustLevel === 0
                  ? ''
                  : registrationSettings.OIDCMinTrustLevel
              }
              onChange={(e) =>
                setRegistrationSettings((prev) => ({
                  ...prev,
                  OIDCMinTrustLevel:
                    e.target.value === '' ? 0 : parseInt(e.target.value),
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              仅LinuxDo网站有效。设置为0时不判断�?-4表示最低信任等级要�?            </p>
          </div>
        </div>
      </details>

      {/* 操作按钮 */}
      <div className='flex justify-end'>
        <button
          onClick={handleSave}
          disabled={isLoading('saveRegistrationConfig')}
          className={`px-4 py-2 ${
            isLoading('saveRegistrationConfig')
              ? buttonStyles.disabled
              : buttonStyles.success
          } rounded-lg transition-colors`}
        >
          {isLoading('saveRegistrationConfig') ? '保存中�? : '保存'}
        </button>
      </div>

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />

      {/* 开启注册确认弹�?*/}
      {showEnableRegistrationModal &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => setShowEnableRegistrationModal(false)}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    开启注册功�?                  </h3>
                  <button
                    onClick={() => setShowEnableRegistrationModal(false)}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='mb-6'>
                  <div className='bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4'>
                    <div className='flex items-center space-x-2 mb-2'>
                      <AlertTriangle className='w-5 h-5 text-yellow-600 dark:text-yellow-400' />
                      <span className='text-sm font-medium text-yellow-800 dark:text-yellow-300'>
                        安全提示
                      </span>
                    </div>
                    <p className='text-sm text-yellow-700 dark:text-yellow-400'>
                      为了您的安全和避免潜在的法律风险,如果您的网站部署在公网不建议开启�?                    </p>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={() => setShowEnableRegistrationModal(false)}
                    className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.secondary}`}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmEnableRegistration}
                    className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.primary}`}
                  >
                    我已知晓，确认开�?                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

// 自定义去广告配置组件
const CustomAdFilterConfig = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [adFilterCode, setAdFilterCode] = useState('');

  // 默认去广告代�?  const defaultAdFilterCode = `function filterAdsFromM3U8(type: string, m3u8Content: string): string {
  if (!m3u8Content) return '';

  // 广告关键字列�?  const adKeywords = [
    'sponsor',
    '/ad/',
    '/ads/',
    'advert',
    'advertisement',
    '/adjump',
    'redtraffic'
  ];

  // 按行分割M3U8内容
  const lines = m3u8Content.split('\\n');
  const filteredLines = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 跳过 #EXT-X-DISCONTINUITY 标识
    if (line.includes('#EXT-X-DISCONTINUITY')) {
      i++;
      continue;
    }

    // 如果�?EXTINF 行，检查下一�?URL 是否包含广告关键�?    if (line.includes('#EXTINF:')) {
      // 检查下一�?URL 是否包含广告关键�?      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const containsAdKeyword = adKeywords.some(keyword =>
          nextLine.toLowerCase().includes(keyword.toLowerCase())
        );

        if (containsAdKeyword) {
          // 跳过 EXTINF 行和 URL �?          i += 2;
          continue;
        }
      }
    }

    // 保留当前�?    filteredLines.push(line);
    i++;
  }

  return filteredLines.join('\\n');
}`;

  useEffect(() => {
    // 从数据库配置读取自定义去广告代码
    if (config?.SiteConfig?.CustomAdFilterCode) {
      setAdFilterCode(config.SiteConfig.CustomAdFilterCode);
    } else {
      // 如果数据库没有保存的代码，使用默认代�?      setAdFilterCode(defaultAdFilterCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // 移除 TypeScript 类型注解，转换为�?JavaScript
  const removeTypeAnnotations = (code: string): string => {
    return (
      code
        // 移除函数参数的类型注解：name: type
        .replace(
          /(\w+)\s*:\s*(string|number|boolean|any|void|never|unknown|object)\s*([,)])/g,
          '$1$3'
        )
        // 移除函数返回值类型注解：): type {
        .replace(
          /\)\s*:\s*(string|number|boolean|any|void|never|unknown|object)\s*\{/g,
          ') {'
        )
        // 移除变量声明的类型注解：const name: type =
        .replace(
          /(const|let|var)\s+(\w+)\s*:\s*(string|number|boolean|any|void|never|unknown|object)\s*=/g,
          '$1 $2 ='
        )
    );
  };

  // 保存自定义去广告代码
  const handleSave = async () => {
    await withLoading('saveAdFilterCode', async () => {
      try {
        // 验证代码语法
        try {
          // 移除类型注解后验�?          const jsCode = removeTypeAnnotations(adFilterCode);
          // 使用 Function 构造器验证代码是否可以解析
          new Function(
            'type',
            'm3u8Content',
            jsCode + '\nreturn filterAdsFromM3U8(type, m3u8Content);'
          );
        } catch (parseError) {
          console.error('代码验证失败:', parseError);
          showError(
            '代码语法错误�? +
              (parseError instanceof Error
                ? parseError.message
                : '请检查代码格�?),
            showAlert
          );
          return;
        }

        // 更新配置到数据库
        if (!config) {
          showError('配置未加�?, showAlert);
          return;
        }

        // 准备更新的站点配置，包含自定义去广告代码
        const updatedSiteConfig = {
          ...config.SiteConfig,
          CustomAdFilterCode: adFilterCode,
          CustomAdFilterVersion: Date.now(), // 使用时间戳作为版本号
        };

        const response = await fetch('/api/admin/site', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedSiteConfig),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '保存配置失败');
        }

        // 刷新配置
        await refreshConfig();

        showSuccess('去广告代码保存成功，刷新后生�?, showAlert);
      } catch (err) {
        showError(err instanceof Error ? err.message : '保存失败', showAlert);
        throw err;
      }
    });
  };

  // 重置为默认代�?  const handleReset = () => {
    setAdFilterCode(defaultAdFilterCode);
    showSuccess('已重置为默认代码', showAlert);
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载�?..
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {/* 说明区域 */}
      <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
        <div className='flex items-center space-x-2 mb-2'>
          <svg
            className='w-5 h-5 text-blue-600 dark:text-blue-400'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
            />
          </svg>
          <span className='text-sm font-medium text-blue-800 dark:text-blue-300'>
            使用说明
          </span>
        </div>
        <div className='text-sm text-blue-700 dark:text-blue-400 space-y-1'>
          <p>�?此功能用于自定义 M3U8 播放列表的去广告逻辑</p>
          <p>�?配置保存到数据库，对全平台所有用户生�?/p>
          <p>
            �?客户端会自动缓存代码，只在版本更新时重新获取，不会频繁请求服务器
          </p>
          <p>
            �?函数签名必须�?{' '}
            <code className='bg-blue-100 dark:bg-blue-900/40 px-1 rounded'>
              filterAdsFromM3U8(type, m3u8Content)
            </code>
          </p>
          <p>�?type 参数为视频源类型，m3u8Content 为播放列表内�?/p>
          <p>�?函数需要返回处理后�?M3U8 内容</p>
          <p>�?支持 TypeScript 类型注解，保存时会自动转换为 JavaScript</p>
        </div>
      </div>

      {/* 代码编辑区域 */}
      <div className='space-y-3'>
        <div className='flex items-center justify-between'>
          <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
            自定义去广告代码
          </label>
          <button
            onClick={handleReset}
            className={`${buttonStyles.secondarySmall}`}
          >
            重置为默�?          </button>
        </div>
        <div className='relative'>
          <textarea
            value={adFilterCode}
            onChange={(e) => setAdFilterCode(e.target.value)}
            rows={25}
            placeholder='请输入自定义去广告代�?..'
            className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm leading-relaxed resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-400 dark:hover:border-gray-500'
            style={{
              fontFamily:
                'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
            }}
            spellCheck={false}
            data-gramm={false}
          />
        </div>

        <div className='flex items-center justify-between'>
          <div className='text-xs text-gray-500 dark:text-gray-400'>
            修改后需保存才能生效，保存前会进行语法验�?          </div>
          <button
            onClick={handleSave}
            disabled={isLoading('saveAdFilterCode')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isLoading('saveAdFilterCode')
                ? buttonStyles.disabled
                : buttonStyles.success
            }`}
          >
            {isLoading('saveAdFilterCode') ? '保存中�? : '保存'}
          </button>
        </div>
      </div>

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

// 小雅配置组件

const SuwayomiConfigComponent = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [enabled, setEnabled] = useState(false);
  const [serverURL, setServerURL] = useState('');
  const [authMode, setAuthMode] = useState<
    'none' | 'basic_auth' | 'simple_login'
  >('none');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [defaultLang, setDefaultLang] = useState('zh');
  const [sourceIds, setSourceIds] = useState('');
  const [maxSources, setMaxSources] = useState(10);

  useEffect(() => {
    if (config?.SuwayomiConfig) {
      setEnabled(config.SuwayomiConfig.Enabled || false);
      setServerURL(config.SuwayomiConfig.ServerURL || '');
      setAuthMode(config.SuwayomiConfig.AuthMode || 'none');
      setUsername(config.SuwayomiConfig.Username || '');
      setPassword(config.SuwayomiConfig.Password || '');
      setDefaultLang(config.SuwayomiConfig.DefaultLang || 'zh');
      setSourceIds((config.SuwayomiConfig.SourceIds || []).join(','));
      setMaxSources(config.SuwayomiConfig.MaxSources || 10);
    }
  }, [config]);

  const buildConfig = () => ({
    Enabled: enabled,
    ServerURL: serverURL,
    AuthMode: authMode,
    Username: authMode === 'none' ? '' : username,
    Password: authMode === 'none' ? '' : password,
    DefaultLang: defaultLang || 'zh',
    SourceIds: sourceIds
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    MaxSources: Math.max(1, maxSources || 10),
  });

  const handleSave = async () => {
    await withLoading('saveSuwayomi', async () => {
      try {
        if (!config) throw new Error('配置未加�?);

        const response = await fetch('/api/admin/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...config,
            SuwayomiConfig: buildConfig(),
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '保存失败');
        }

        showSuccess('漫画后端配置已保�?, showAlert);
        await refreshConfig();
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '保存失败',
          showAlert
        );
        throw error;
      }
    });
  };

  const handleTest = async () => {
    await withLoading('testSuwayomi', async () => {
      try {
        const response = await fetch('/api/admin/suwayomi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ServerURL: serverURL,
            AuthMode: authMode,
            Username: username,
            Password: password,
            DefaultLang: defaultLang,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || data.error || '测试连接失败');
        }

        showSuccess(data.message || '连接成功', showAlert);
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '测试连接失败',
          showAlert
        );
        throw error;
      }
    });
  };

  return (
    <div className='space-y-6'>
      <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
        <h3 className='text-sm font-medium text-blue-900 dark:text-blue-100 mb-2'>
          关于漫画展馆 / Suwayomi
        </h3>
        <div className='text-sm text-blue-800 dark:text-blue-200 space-y-1'>
          <p>
            �?漫画展馆通过 Suwayomi Server �?GraphQL
            接口搜索、拉取章节与阅读页�?          </p>
          <p>
            �?认证仅支�?basic_auth �?            simple_login；未开启认证时请选择“无认证”�?          </p>
          <p>�?可限制默认语言、可用源白名单，以及单次搜索最多查询的源数量�?/p>
          <p>�?保存后漫画模块会优先使用这里的配置，环境变量只作为兜底�?/p>
        </div>
      </div>

      <div className='space-y-4'>
        <div className='flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700'>
          <div>
            <h3 className='text-sm font-medium text-gray-900 dark:text-white'>
              启用漫画展馆
            </h3>
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
              关闭后仍保留代码，但不建议在未配置时对用户开放入口�?            </p>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            Suwayomi 服务地址
          </label>
          <input
            type='text'
            value={serverURL}
            onChange={(e) => setServerURL(e.target.value)}
            placeholder='http://127.0.0.1:4567'
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
          />
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            只填服务根地址，程序会自动拼接 /api/graphql�?          </p>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            认证方式
          </label>
          <div className='grid grid-cols-1 gap-2 md:grid-cols-3'>
            {[
              { value: 'none', label: '无认�? },
              { value: 'basic_auth', label: 'basic_auth' },
              { value: 'simple_login', label: 'simple_login' },
            ].map((item) => (
              <button
                key={item.value}
                type='button'
                onClick={() =>
                  setAuthMode(
                    item.value as 'none' | 'basic_auth' | 'simple_login'
                  )
                }
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  authMode === item.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-200'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            basic_auth 使用 Basic Authorization 头；simple_login 会向
            /login.html 提交表单并复用返�?Cookie�?          </p>
        </div>

        {authMode !== 'none' && (
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                用户�?              </label>
              <input
                type='text'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder='登录用户�?
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                密码
              </label>
              <input
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder='登录密码'
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
          </div>
        )}

        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              默认语言
            </label>
            <input
              type='text'
              value={defaultLang}
              onChange={(e) => setDefaultLang(e.target.value)}
              placeholder='zh'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              单次搜索最大源�?            </label>
            <input
              type='number'
              min='1'
              value={maxSources}
              onChange={(e) => setMaxSources(parseInt(e.target.value) || 10)}
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            源白名单
          </label>
          <textarea
            value={sourceIds}
            onChange={(e) => setSourceIds(e.target.value)}
            rows={3}
            placeholder='留空表示使用默认语言下全部源；填写时用英文逗号分隔 sourceId'
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
          />
        </div>

        <div className='flex gap-3'>
          <button
            onClick={handleTest}
            disabled={!serverURL || isLoading('testSuwayomi')}
            className={buttonStyles.primary}
          >
            {isLoading('testSuwayomi') ? '测试�?..' : '测试连接'}
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading('saveSuwayomi')}
            className={buttonStyles.success}
          >
            {isLoading('saveSuwayomi') ? '保存�?..' : '保存配置'}
          </button>
        </div>
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

const OPDSConfigComponent = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [enabled, setEnabled] = useState(false);
  const [cacheTTL, setCacheTTL] = useState(10 * 60 * 1000);
  const [sources, setSources] = useState<BookSource[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (config?.OPDSConfig) {
      setEnabled(config.OPDSConfig.Enabled || false);
      setCacheTTL(config.OPDSConfig.CacheTTL || 10 * 60 * 1000);
      setSources(
        (config.OPDSConfig.Sources || []).map((item, index) => ({
          id: item.id || `source_${index + 1}`,
          name: item.name || `书源 ${index + 1}`,
          url: item.url || '',
          enabled: item.enabled !== false,
          authMode: item.authMode || 'none',
          username: item.username || '',
          password: item.password || '',
          headerName: item.headerName || '',
          headerValue: item.headerValue || '',
          searchTemplate: item.searchTemplate || '',
          preferFormat: item.preferFormat || ['epub', 'pdf'],
          language: item.language || '',
        }))
      );
      setEditingIndex(null);
    }
  }, [config]);

  useEffect(() => {
    setEditingIndex((prev) => {
      if (prev === null) return prev;
      return prev >= sources.length ? null : prev;
    });
  }, [sources.length]);

  const updateSource = (index: number, patch: Partial<BookSource>) => {
    setSources((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  };

  const addSource = () => {
    setSources((prev) => {
      const nextIndex = prev.length;
      setEditingIndex(nextIndex);
      return [
        ...prev,
        {
          id: `source_${prev.length + 1}`,
          name: `书源 ${prev.length + 1}`,
          url: '',
          enabled: true,
          authMode: 'none',
          username: '',
          password: '',
          headerName: '',
          headerValue: '',
          searchTemplate: '',
          preferFormat: ['epub', 'pdf'],
          language: '',
        },
      ];
    });
  };

  const removeSource = (index: number) => {
    setSources((prev) => prev.filter((_, idx) => idx !== index));
    setEditingIndex((prev) => {
      if (prev === null) return prev;
      if (prev === index) return null;
      return prev > index ? prev - 1 : prev;
    });
  };

  const normalizeSource = (source: BookSource, index: number) => ({
    id: source.id?.trim() || `source_${index + 1}`,
    name: source.name?.trim() || `书源 ${index + 1}`,
    url: source.url?.trim() || '',
    enabled: source.enabled !== false,
    authMode: source.authMode || 'none',
    username: source.authMode === 'none' ? '' : source.username?.trim() || '',
    password: source.authMode === 'none' ? '' : source.password || '',
    headerName:
      source.authMode === 'header' ? source.headerName?.trim() || '' : '',
    headerValue: source.authMode === 'header' ? source.headerValue || '' : '',
    searchTemplate: source.searchTemplate?.trim() || '',
    preferFormat: source.preferFormat?.length
      ? source.preferFormat
      : ['epub', 'pdf'],
    language: source.language?.trim() || '',
  });

  const buildConfig = () => ({
    Enabled: enabled,
    CacheTTL: Math.max(60_000, cacheTTL || 10 * 60 * 1000),
    Sources: sources.map(normalizeSource).filter((source) => !!source.url),
  });

  const handleSave = async () => {
    await withLoading('saveOPDSConfig', async () => {
      try {
        if (!config) throw new Error('配置未加�?);
        const response = await fetch('/api/admin/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...config,
            OPDSConfig: buildConfig(),
          }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '保存失败');
        }
        showSuccess('电子�?OPDS 配置已保�?, showAlert);
        await refreshConfig();
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '保存失败',
          showAlert
        );
        throw error;
      }
    });
  };

  const handleTest = async (index: number) => {
    await withLoading(`testOPDSConfig-${index}`, async () => {
      try {
        const source = normalizeSource(sources[index], index);
        if (!source?.url) {
          throw new Error('请先填写书源地址');
        }
        const response = await fetch('/api/admin/opds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Enabled: true,
            CacheTTL: Math.max(60_000, cacheTTL || 10 * 60 * 1000),
            Sources: [source],
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || data.error || '测试连接失败');
        }
        const result = Array.isArray(data.results) ? data.results[0] : null;
        const summary = result
          ? `${result.name}: 分类${
              result.capability.catalogSupported ? '�? : '×'
            } / 搜索${result.capability.searchSupported ? '�? : '×'}${
              result.capability.lastError
                ? ` (${result.capability.lastError})`
                : ''
            }`
          : data.message || '测试成功';
        showSuccess(summary, showAlert);
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '测试连接失败',
          showAlert
        );
        throw error;
      }
    });
  };

  return (
    <div className='space-y-6'>
      <div className='bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4'>
        <h3 className='text-sm font-medium text-amber-900 dark:text-amber-100 mb-2'>
          关于电子书馆 / OPDS
        </h3>
        <div className='text-sm text-amber-800 dark:text-amber-200 space-y-1'>
          <p>�?支持多书源，每个源可独立配置认证、搜索模板与默认格式偏好�?/p>
          <p>
            �?有些源只支持分类浏览，有些源只支持搜索，测试连接会自动探测能力�?          </p>
          <p>�?目前前台优先支持 EPUB 在线阅读，PDF 走内嵌预览�?/p>
        </div>
      </div>

      <div className='flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700'>
        <div>
          <h3 className='text-sm font-medium text-gray-900 dark:text-white'>
            启用电子书馆
          </h3>
          <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
            关闭后不会展�?OPDS 电子书入口�?          </p>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-amber-600' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div>
        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
          Feed 缓存时长（毫秒）
        </label>
        <input
          type='number'
          min='60000'
          value={cacheTTL}
          onChange={(e) =>
            setCacheTTL(parseInt(e.target.value) || 10 * 60 * 1000)
          }
          className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
        />
      </div>

      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h3 className='text-sm font-medium text-gray-900 dark:text-white'>
            书源列表
          </h3>
          <button
            type='button'
            onClick={addSource}
            className={buttonStyles.primary}
          >
            <Plus size={16} className='inline mr-1' />
            添加书源
          </button>
        </div>

        {sources.length === 0 && (
          <div className='rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 text-sm text-gray-500 dark:text-gray-400'>
            暂无 OPDS 书源，点击“添加书源”开始配置�?          </div>
        )}

        {sources.length > 0 && (
          <>
            <div className='space-y-3 md:hidden'>
              {sources.map((source, index) => {
                const isEditing = editingIndex === index;
                return (
                  <div
                    key={`opds-source-${index}`}
                    className='overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
                  >
                    <div className='space-y-3 p-4'>
                      <div className='flex items-start justify-between gap-3'>
                        <div className='min-w-0 flex-1'>
                          <div className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                            {source.name || `书源 ${index + 1}`}
                          </div>
                          <div className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                            {source.id || '未设�?ID'}
                          </div>
                        </div>
                        <button
                          type='button'
                          onClick={() =>
                            updateSource(index, {
                              enabled: source.enabled === false,
                            })
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                            source.enabled !== false
                              ? 'bg-green-600'
                              : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              source.enabled !== false
                                ? 'translate-x-6'
                                : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className='space-y-2 text-xs text-gray-600 dark:text-gray-300'>
                        <div className='flex items-start justify-between gap-3'>
                          <span className='shrink-0 text-gray-500 dark:text-gray-400'>
                            地址
                          </span>
                          <span className='min-w-0 text-right break-all'>
                            {source.url || '-'}
                          </span>
                        </div>
                        <div className='flex items-center justify-between gap-3'>
                          <span className='text-gray-500 dark:text-gray-400'>
                            认证
                          </span>
                          <span>
                            {source.authMode === 'none'
                              ? '无认�?
                              : source.authMode === 'basic'
                              ? 'Basic Auth'
                              : '自定�?Header'}
                          </span>
                        </div>
                        <div className='flex items-center justify-between gap-3'>
                          <span className='text-gray-500 dark:text-gray-400'>
                            搜索
                          </span>
                          <span>
                            {source.searchTemplate?.trim()
                              ? '已配�?
                              : '未配�?}
                          </span>
                        </div>
                        <div className='flex items-center justify-between gap-3'>
                          <span className='text-gray-500 dark:text-gray-400'>
                            格式
                          </span>
                          <span>{source.preferFormat?.join(', ') || '-'}</span>
                        </div>
                      </div>

                      <div className='flex flex-wrap items-center justify-end gap-2'>
                        <button
                          type='button'
                          onClick={() => handleTest(index)}
                          disabled={isLoading(`testOPDSConfig-${index}`)}
                          className={buttonStyles.primarySmall}
                        >
                          {isLoading(`testOPDSConfig-${index}`)
                            ? '测试�?..'
                            : '测试'}
                        </button>
                        <button
                          type='button'
                          onClick={() =>
                            setEditingIndex(isEditing ? null : index)
                          }
                          className={buttonStyles.secondarySmall}
                        >
                          {isEditing ? (
                            <>
                              <ChevronUp size={14} className='inline mr-1' />
                              收起
                            </>
                          ) : (
                            <>
                              <Settings size={14} className='inline mr-1' />
                              编辑
                            </>
                          )}
                        </button>
                        <button
                          type='button'
                          onClick={() => removeSource(index)}
                          className={buttonStyles.dangerSmall}
                        >
                          <Trash2 size={14} className='inline mr-1' />
                          删除
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <div className='space-y-4 border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40'>
                        <div className='text-sm font-medium text-gray-900 dark:text-white'>
                          编辑书源 #{index + 1}
                        </div>

                        <div className='grid grid-cols-1 gap-4'>
                          <div>
                            <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                              书源 ID
                            </label>
                            <input
                              type='text'
                              value={source.id}
                              onChange={(e) =>
                                updateSource(index, { id: e.target.value })
                              }
                              className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                            />
                          </div>
                          <div>
                            <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                              书源名称
                            </label>
                            <input
                              type='text'
                              value={source.name}
                              onChange={(e) =>
                                updateSource(index, { name: e.target.value })
                              }
                              className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                            />
                          </div>
                        </div>

                        <div>
                          <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                            根地址
                          </label>
                          <input
                            type='text'
                            value={source.url}
                            onChange={(e) =>
                              updateSource(index, { url: e.target.value })
                            }
                            placeholder='https://example.com/opds'
                            className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                          />
                        </div>

                        <div className='grid grid-cols-1 gap-4'>
                          <div>
                            <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                              认证方式
                            </label>
                            <select
                              value={source.authMode || 'none'}
                              onChange={(e) =>
                                updateSource(index, {
                                  authMode: e.target
                                    .value as BookSource['authMode'],
                                })
                              }
                              className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                            >
                              <option value='none'>无认�?/option>
                              <option value='basic'>Basic Auth</option>
                              <option value='header'>自定�?Header</option>
                            </select>
                          </div>
                          <div>
                            <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                              语言
                            </label>
                            <input
                              type='text'
                              value={source.language || ''}
                              onChange={(e) =>
                                updateSource(index, {
                                  language: e.target.value,
                                })
                              }
                              placeholder='zh / en'
                              className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                            />
                          </div>
                          <div>
                            <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                              搜索模板
                            </label>
                            <input
                              type='text'
                              value={source.searchTemplate || ''}
                              onChange={(e) =>
                                updateSource(index, {
                                  searchTemplate: e.target.value,
                                })
                              }
                              placeholder='https://...{searchTerms}'
                              className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                            />
                          </div>
                        </div>

                        {source.authMode === 'basic' && (
                          <div className='grid grid-cols-1 gap-4'>
                            <div>
                              <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                用户�?                              </label>
                              <input
                                type='text'
                                value={source.username || ''}
                                onChange={(e) =>
                                  updateSource(index, {
                                    username: e.target.value,
                                  })
                                }
                                className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                              />
                            </div>
                            <div>
                              <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                密码
                              </label>
                              <input
                                type='password'
                                value={source.password || ''}
                                onChange={(e) =>
                                  updateSource(index, {
                                    password: e.target.value,
                                  })
                                }
                                className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                              />
                            </div>
                          </div>
                        )}

                        {source.authMode === 'header' && (
                          <div className='grid grid-cols-1 gap-4'>
                            <div>
                              <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                Header 名称
                              </label>
                              <input
                                type='text'
                                value={source.headerName || ''}
                                onChange={(e) =>
                                  updateSource(index, {
                                    headerName: e.target.value,
                                  })
                                }
                                className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                              />
                            </div>
                            <div>
                              <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                Header �?                              </label>
                              <input
                                type='password'
                                value={source.headerValue || ''}
                                onChange={(e) =>
                                  updateSource(index, {
                                    headerValue: e.target.value,
                                  })
                                }
                                className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className='hidden overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 md:block'>
              <div className='overflow-x-auto'>
                <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
                  <thead className='bg-gray-50 dark:bg-gray-800/70'>
                    <tr>
                      <th className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'>
                        启用
                      </th>
                      <th className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'>
                        名称
                      </th>
                      <th className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'>
                        ID
                      </th>
                      <th className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'>
                        地址
                      </th>
                      <th className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'>
                        认证
                      </th>
                      <th className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'>
                        搜索
                      </th>
                      <th className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'>
                        格式偏好
                      </th>
                      <th className='px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'>
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900'>
                    {sources.map((source, index) => {
                      const isEditing = editingIndex === index;
                      return (
                        <Fragment key={`opds-source-${index}`}>
                          <tr className='align-top'>
                            <td className='px-4 py-3'>
                              <button
                                type='button'
                                onClick={() =>
                                  updateSource(index, {
                                    enabled: source.enabled === false,
                                  })
                                }
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  source.enabled !== false
                                    ? 'bg-green-600'
                                    : 'bg-gray-200 dark:bg-gray-700'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    source.enabled !== false
                                      ? 'translate-x-6'
                                      : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </td>
                            <td className='px-4 py-3 text-sm text-gray-900 dark:text-gray-100'>
                              <div className='font-medium'>
                                {source.name || `书源 ${index + 1}`}
                              </div>
                              <div className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                                {source.language || '未设置语言'}
                              </div>
                            </td>
                            <td className='px-4 py-3 text-sm text-gray-600 dark:text-gray-300'>
                              {source.id || '-'}
                            </td>
                            <td className='px-4 py-3 text-sm text-gray-600 dark:text-gray-300'>
                              <div
                                className='max-w-[320px] truncate'
                                title={source.url || ''}
                              >
                                {source.url || '-'}
                              </div>
                            </td>
                            <td className='px-4 py-3 text-sm text-gray-600 dark:text-gray-300'>
                              {source.authMode === 'none'
                                ? '无认�?
                                : source.authMode === 'basic'
                                ? 'Basic Auth'
                                : '自定�?Header'}
                            </td>
                            <td className='px-4 py-3 text-sm text-gray-600 dark:text-gray-300'>
                              {source.searchTemplate?.trim()
                                ? '已配�?
                                : '未配�?}
                            </td>
                            <td className='px-4 py-3 text-sm text-gray-600 dark:text-gray-300'>
                              {source.preferFormat?.join(', ') || '-'}
                            </td>
                            <td className='px-4 py-3'>
                              <div className='flex flex-wrap items-center justify-end gap-2'>
                                <button
                                  type='button'
                                  onClick={() => handleTest(index)}
                                  disabled={isLoading(
                                    `testOPDSConfig-${index}`
                                  )}
                                  className={buttonStyles.primarySmall}
                                >
                                  {isLoading(`testOPDSConfig-${index}`)
                                    ? '测试�?..'
                                    : '测试'}
                                </button>
                                <button
                                  type='button'
                                  onClick={() =>
                                    setEditingIndex(isEditing ? null : index)
                                  }
                                  className={buttonStyles.secondarySmall}
                                >
                                  {isEditing ? (
                                    <>
                                      <ChevronUp
                                        size={14}
                                        className='inline mr-1'
                                      />
                                      收起
                                    </>
                                  ) : (
                                    <>
                                      <Settings
                                        size={14}
                                        className='inline mr-1'
                                      />
                                      编辑
                                    </>
                                  )}
                                </button>
                                <button
                                  type='button'
                                  onClick={() => removeSource(index)}
                                  className={buttonStyles.dangerSmall}
                                >
                                  <Trash2 size={14} className='inline mr-1' />
                                  删除
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isEditing && (
                            <tr>
                              <td
                                colSpan={8}
                                className='bg-gray-50 px-4 py-4 dark:bg-gray-800/40'
                              >
                                <div className='space-y-4'>
                                  <div className='flex items-center justify-between gap-3'>
                                    <div>
                                      <div className='text-sm font-medium text-gray-900 dark:text-white'>
                                        编辑书源 #{index + 1}
                                      </div>
                                      <div className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                                        仅展开当前书源，保存时统一提交�?                                      </div>
                                    </div>
                                    <button
                                      type='button'
                                      onClick={() => setEditingIndex(null)}
                                      className={buttonStyles.secondarySmall}
                                    >
                                      <ChevronUp
                                        size={14}
                                        className='inline mr-1'
                                      />
                                      收起
                                    </button>
                                  </div>

                                  <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                                    <div>
                                      <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                        书源 ID
                                      </label>
                                      <input
                                        type='text'
                                        value={source.id}
                                        onChange={(e) =>
                                          updateSource(index, {
                                            id: e.target.value,
                                          })
                                        }
                                        className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                                      />
                                    </div>
                                    <div>
                                      <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                        书源名称
                                      </label>
                                      <input
                                        type='text'
                                        value={source.name}
                                        onChange={(e) =>
                                          updateSource(index, {
                                            name: e.target.value,
                                          })
                                        }
                                        className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                      根地址
                                    </label>
                                    <input
                                      type='text'
                                      value={source.url}
                                      onChange={(e) =>
                                        updateSource(index, {
                                          url: e.target.value,
                                        })
                                      }
                                      placeholder='https://example.com/opds'
                                      className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                                    />
                                  </div>

                                  <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
                                    <div>
                                      <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                        认证方式
                                      </label>
                                      <select
                                        value={source.authMode || 'none'}
                                        onChange={(e) =>
                                          updateSource(index, {
                                            authMode: e.target
                                              .value as BookSource['authMode'],
                                          })
                                        }
                                        className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                                      >
                                        <option value='none'>无认�?/option>
                                        <option value='basic'>
                                          Basic Auth
                                        </option>
                                        <option value='header'>
                                          自定�?Header
                                        </option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                        语言
                                      </label>
                                      <input
                                        type='text'
                                        value={source.language || ''}
                                        onChange={(e) =>
                                          updateSource(index, {
                                            language: e.target.value,
                                          })
                                        }
                                        placeholder='zh / en'
                                        className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                                      />
                                    </div>
                                    <div>
                                      <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                        搜索模板
                                      </label>
                                      <input
                                        type='text'
                                        value={source.searchTemplate || ''}
                                        onChange={(e) =>
                                          updateSource(index, {
                                            searchTemplate: e.target.value,
                                          })
                                        }
                                        placeholder='https://...{searchTerms}'
                                        className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                                      />
                                    </div>
                                  </div>

                                  {source.authMode === 'basic' && (
                                    <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                                      <div>
                                        <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                          用户�?                                        </label>
                                        <input
                                          type='text'
                                          value={source.username || ''}
                                          onChange={(e) =>
                                            updateSource(index, {
                                              username: e.target.value,
                                            })
                                          }
                                          className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                                        />
                                      </div>
                                      <div>
                                        <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                          密码
                                        </label>
                                        <input
                                          type='password'
                                          value={source.password || ''}
                                          onChange={(e) =>
                                            updateSource(index, {
                                              password: e.target.value,
                                            })
                                          }
                                          className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {source.authMode === 'header' && (
                                    <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                                      <div>
                                        <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                          Header 名称
                                        </label>
                                        <input
                                          type='text'
                                          value={source.headerName || ''}
                                          onChange={(e) =>
                                            updateSource(index, {
                                              headerName: e.target.value,
                                            })
                                          }
                                          className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                                        />
                                      </div>
                                      <div>
                                        <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                          Header �?                                        </label>
                                        <input
                                          type='password'
                                          value={source.headerValue || ''}
                                          onChange={(e) =>
                                            updateSource(index, {
                                              headerValue: e.target.value,
                                            })
                                          }
                                          className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <div className='flex gap-3'>
        <button
          onClick={handleSave}
          disabled={isLoading('saveOPDSConfig')}
          className={buttonStyles.success}
        >
          {isLoading('saveOPDSConfig') ? '保存�?..' : '保存 OPDS 配置'}
        </button>
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

const XiaoyaConfigComponent = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [enabled, setEnabled] = useState(false);
  const [serverURL, setServerURL] = useState('');
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [disableVideoPreview, setDisableVideoPreview] = useState(false);

  useEffect(() => {
    if (config?.XiaoyaConfig) {
      setEnabled(config.XiaoyaConfig.Enabled || false);
      setServerURL(config.XiaoyaConfig.ServerURL || '');
      setToken(config.XiaoyaConfig.Token || '');
      setUsername(config.XiaoyaConfig.Username || '');
      setPassword(config.XiaoyaConfig.Password || '');
      setDisableVideoPreview(config.XiaoyaConfig.DisableVideoPreview || false);
    }
  }, [config]);

  const handleSave = async () => {
    await withLoading('saveXiaoya', async () => {
      try {
        const response = await fetch('/api/admin/xiaoya', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            Enabled: enabled,
            ServerURL: serverURL,
            Token: token,
            Username: username,
            Password: password,
            DisableVideoPreview: disableVideoPreview,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '保存失败');
        }

        showSuccess('保存成功', showAlert);
        await refreshConfig();
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '保存失败',
          showAlert
        );
        throw error;
      }
    });
  };

  const handleTest = async () => {
    await withLoading('testXiaoya', async () => {
      try {
        const response = await fetch('/api/admin/xiaoya', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'test',
            ServerURL: serverURL,
            Token: token,
            Username: username,
            Password: password,
          }),
        });

        const data = await response.json();
        if (data.success) {
          showSuccess('连接成功', showAlert);
        } else {
          showError(data.message || '连接失败', showAlert);
        }
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '连接失败',
          showAlert
        );
        throw error;
      }
    });
  };

  return (
    <div className='space-y-6'>
      <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
        <h3 className='text-sm font-medium text-blue-900 dark:text-blue-100 mb-2'>
          关于小雅
        </h3>
        <div className='text-sm text-blue-800 dark:text-blue-200 space-y-1'>
          <p>�?小雅是基�?Alist 的网盘资源聚合服�?/p>
          <p>
            �?支持文件夹名自动识别 TMDb ID（格式：标题 (年份) {'{tmdb-id}'}�?          </p>
          <p>�?支持 NFO 文件元数据（poster.jpg、background.jpg�?/p>
          <p>�?按需加载，无需全量扫描</p>
        </div>
      </div>

      <div className='space-y-4'>
        <div className='flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700'>
          <div>
            <h3 className='text-sm font-medium text-gray-900 dark:text-white'>
              启用小雅功能
            </h3>
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
              关闭后将不显示小雅入�?            </p>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            Alist 服务器地址
          </label>
          <input
            type='text'
            value={serverURL}
            onChange={(e) => setServerURL(e.target.value)}
            placeholder='http://localhost:5244'
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
          />
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            小雅 Alist 服务器的完整地址
          </p>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            Token（推荐）
          </label>
          <input
            type='password'
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder='可选，使用 Token 认证'
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
          />
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              用户�?            </label>
            <input
              type='text'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder='可选，用户名密码认�?
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              密码
            </label>
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder='可�?
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>
        </div>

        <div className='flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700'>
          <div>
            <h3 className='text-sm font-medium text-gray-900 dark:text-white'>
              禁用预览视频
            </h3>
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
              开启后将直接返回直连链接，不使用视频预览流
            </p>
          </div>
          <button
            onClick={() => setDisableVideoPreview(!disableVideoPreview)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              disableVideoPreview
                ? 'bg-blue-600'
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                disableVideoPreview ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className='flex gap-3'>
          <button
            onClick={handleTest}
            disabled={!serverURL || isLoading('testXiaoya')}
            className={buttonStyles.primary}
          >
            {isLoading('testXiaoya') ? '测试�?..' : '测试连接'}
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading('saveXiaoya')}
            className={buttonStyles.success}
          >
            {isLoading('saveXiaoya') ? '保存�?..' : '保存配置'}
          </button>
        </div>
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

// 邮件配置组件
const EmailConfigComponent = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<'smtp' | 'resend'>('smtp');

  // SMTP配置
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');

  // Resend配置
  const [resendApiKey, setResendApiKey] = useState('');
  const [resendFrom, setResendFrom] = useState('');

  // 测试邮件
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    if (config?.EmailConfig) {
      setEnabled(config.EmailConfig.enabled || false);
      setProvider(config.EmailConfig.provider || 'smtp');

      if (config.EmailConfig.smtp) {
        setSmtpHost(config.EmailConfig.smtp.host || '');
        setSmtpPort(config.EmailConfig.smtp.port || 587);
        setSmtpSecure(config.EmailConfig.smtp.secure || false);
        setSmtpUser(config.EmailConfig.smtp.user || '');
        setSmtpPassword(config.EmailConfig.smtp.password || '');
        setSmtpFrom(config.EmailConfig.smtp.from || '');
      }

      if (config.EmailConfig.resend) {
        setResendApiKey(config.EmailConfig.resend.apiKey || '');
        setResendFrom(config.EmailConfig.resend.from || '');
      }
    }
  }, [config]);

  const handleSave = async () => {
    await withLoading('saveEmail', async () => {
      try {
        const emailConfig: AdminConfig['EmailConfig'] = {
          enabled,
          provider,
          smtp:
            provider === 'smtp'
              ? {
                  host: smtpHost,
                  port: smtpPort,
                  secure: smtpSecure,
                  user: smtpUser,
                  password: smtpPassword,
                  from: smtpFrom,
                }
              : undefined,
          resend:
            provider === 'resend'
              ? {
                  apiKey: resendApiKey,
                  from: resendFrom,
                }
              : undefined,
        };

        const response = await fetch('/api/admin/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            config: emailConfig,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '保存失败');
        }

        showSuccess('保存成功', showAlert);
        await refreshConfig();
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '保存失败',
          showAlert
        );
        throw error;
      }
    });
  };

  const handleTest = async () => {
    if (!testEmail) {
      showError('请输入测试邮箱地址', showAlert);
      return;
    }

    await withLoading('testEmail', async () => {
      try {
        const emailConfig: AdminConfig['EmailConfig'] = {
          enabled: true,
          provider,
          smtp:
            provider === 'smtp'
              ? {
                  host: smtpHost,
                  port: smtpPort,
                  secure: smtpSecure,
                  user: smtpUser,
                  password: smtpPassword,
                  from: smtpFrom,
                }
              : undefined,
          resend:
            provider === 'resend'
              ? {
                  apiKey: resendApiKey,
                  from: resendFrom,
                }
              : undefined,
        };

        const response = await fetch('/api/admin/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'test',
            config: emailConfig,
            testEmail,
          }),
        });

        const data = await response.json();
        if (data.success) {
          showSuccess('测试邮件发送成功，请检查收件箱', showAlert);
        } else {
          showError(data.error || '发送失�?, showAlert);
        }
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '发送失�?,
          showAlert
        );
        throw error;
      }
    });
  };

  return (
    <div className='space-y-6'>
      <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
        <h3 className='text-sm font-medium text-blue-900 dark:text-blue-100 mb-2'>
          关于邮件通知
        </h3>
        <div className='text-sm text-blue-800 dark:text-blue-200 space-y-1'>
          <p>�?当用户收藏的影片有更新时，自动发送邮件通知</p>
          <p>�?支持 SMTP �?Resend 两种发送方�?/p>
          <p>�?用户可在个人设置中配置邮箱和通知偏好</p>
        </div>
      </div>

      <div className='space-y-4'>
        {/* 启用开�?*/}
        <div className='flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700'>
          <div>
            <h3 className='text-sm font-medium text-gray-900 dark:text-white'>
              启用邮件通知
            </h3>
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
              开启后用户可以接收收藏更新的邮件通知
            </p>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* 发送方式选择 */}
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            发送方�?          </label>
          <div className='flex gap-4'>
            <label className='flex items-center'>
              <input
                type='radio'
                value='smtp'
                checked={provider === 'smtp'}
                onChange={(e) => setProvider(e.target.value as 'smtp')}
                className='mr-2'
              />
              <span className='text-sm text-gray-700 dark:text-gray-300'>
                SMTP
              </span>
            </label>
            <label className='flex items-center'>
              <input
                type='radio'
                value='resend'
                checked={provider === 'resend'}
                onChange={(e) => setProvider(e.target.value as 'resend')}
                className='mr-2'
              />
              <span className='text-sm text-gray-700 dark:text-gray-300'>
                Resend
              </span>
            </label>
          </div>
        </div>

        {/* SMTP配置 */}
        {provider === 'smtp' && (
          <div className='space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700'>
            <h4 className='text-sm font-medium text-gray-900 dark:text-white'>
              SMTP 配置
            </h4>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  SMTP 主机 *
                </label>
                <input
                  type='text'
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder='smtp.gmail.com'
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  SMTP 端口 *
                </label>
                <input
                  type='number'
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(parseInt(e.target.value))}
                  placeholder='587'
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                />
              </div>
            </div>

            <div className='flex items-center'>
              <input
                type='checkbox'
                checked={smtpSecure}
                onChange={(e) => setSmtpSecure(e.target.checked)}
                className='mr-2'
              />
              <label className='text-sm text-gray-700 dark:text-gray-300'>
                使用 SSL/TLS（端�?465 时启用）
              </label>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                SMTP 用户�?*
              </label>
              <input
                type='text'
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder='your-email@gmail.com'
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                SMTP 密码 *
              </label>
              <input
                type='password'
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder='应用专用密码'
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                发件人邮�?*
              </label>
              <input
                type='email'
                value={smtpFrom}
                onChange={(e) => setSmtpFrom(e.target.value)}
                placeholder='noreply@yourdomain.com'
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
              />
            </div>
          </div>
        )}

        {/* Resend配置 */}
        {provider === 'resend' && (
          <div className='space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700'>
            <h4 className='text-sm font-medium text-gray-900 dark:text-white'>
              Resend 配置
            </h4>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                Resend API Key *
              </label>
              <input
                type='password'
                value={resendApiKey}
                onChange={(e) => setResendApiKey(e.target.value)}
                placeholder='re_xxxxx'
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
              />
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                在{' '}
                <a
                  href='https://resend.com/api-keys'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-blue-600 hover:underline'
                >
                  Resend 控制�?                </a>{' '}
                获取
              </p>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                发件人邮�?*
              </label>
              <input
                type='email'
                value={resendFrom}
                onChange={(e) => setResendFrom(e.target.value)}
                placeholder='noreply@yourdomain.com'
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
              />
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                需要先�?Resend 中验证域�?              </p>
            </div>
          </div>
        )}

        {/* 测试邮件 */}
        <div className='p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg'>
          <h4 className='text-sm font-medium text-blue-900 dark:text-blue-100 mb-2'>
            发送测试邮�?          </h4>
          <div className='flex flex-col sm:flex-row gap-2'>
            <input
              type='email'
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder='输入测试邮箱地址'
              className='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm'
            />
            <button
              onClick={handleTest}
              disabled={isLoading('testEmail') || !testEmail}
              className={`${buttonStyles.primary} whitespace-nowrap`}
            >
              {isLoading('testEmail') ? '发送中...' : '发送测�?}
            </button>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className='flex gap-3'>
          <button
            onClick={handleSave}
            disabled={isLoading('saveEmail')}
            className={buttonStyles.success}
          >
            {isLoading('saveEmail') ? '保存�?..' : '保存配置'}
          </button>
        </div>
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

// 求片列表组件
const MovieRequestsComponent = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [requests, setRequests] = useState<any[]>([]);
  const [filter, setFilter] = useState<'pending' | 'fulfilled'>('pending');
  const [pendingCount, setPendingCount] = useState(0);
  const [fulfilledCount, setFulfilledCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // 求片功能设置
  const [enableMovieRequest, setEnableMovieRequest] = useState(
    config?.SiteConfig?.EnableMovieRequest ?? true
  );
  const [movieRequestCooldown, setMovieRequestCooldown] = useState(
    config?.SiteConfig?.MovieRequestCooldown ?? 3600
  );
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    loadRequests();
    loadCounts();
  }, [filter]);

  const loadCounts = async () => {
    try {
      const response = await fetch('/api/movie-requests');
      const data = await response.json();
      const allRequests = data.requests || [];
      setPendingCount(
        allRequests.filter((r: any) => r.status === 'pending').length
      );
      setFulfilledCount(
        allRequests.filter((r: any) => r.status === 'fulfilled').length
      );
    } catch (error) {
      console.error('加载求片数量失败:', error);
    }
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/movie-requests?status=${filter}&detail=true`
      );
      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('加载求片列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFulfill = async (id: string) => {
    await withLoading(`fulfill_${id}`, async () => {
      try {
        const response = await fetch(`/api/movie-requests/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'fulfilled' }),
        });
        if (!response.ok) throw new Error('操作失败');
        showSuccess('已标记为已上�?, showAlert);
        await loadRequests();
      } catch (err) {
        showError(err instanceof Error ? err.message : '操作失败', showAlert);
      }
    });
  };

  const handleDelete = async (id: string) => {
    await withLoading(`delete_${id}`, async () => {
      try {
        const response = await fetch(`/api/movie-requests/${id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('删除失败');
        showSuccess('删除成功', showAlert);
        await loadRequests();
      } catch (err) {
        showError(err instanceof Error ? err.message : '删除失败', showAlert);
      }
    });
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      if (!config) throw new Error('配置未加�?);

      const updatedConfig = {
        ...config,
        SiteConfig: {
          ...config.SiteConfig,
          EnableMovieRequest: enableMovieRequest,
          MovieRequestCooldown: movieRequestCooldown,
        },
      };

      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig),
      });

      if (!response.ok) throw new Error('保存失败');

      showSuccess('求片设置已保�?, showAlert);
      await refreshConfig();
    } catch (err) {
      showError(err instanceof Error ? err.message : '保存失败', showAlert);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className='space-y-4'>
      {/* 求片功能设置 */}
      <div className='p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
        <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-4'>
          求片功能设置
        </h3>
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                启用求片功能
              </label>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                关闭后用户将无法访问求片页面
              </p>
            </div>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={enableMovieRequest}
                onChange={(e) => setEnableMovieRequest(e.target.checked)}
                className='sr-only peer'
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              求片冷却时间（秒�?            </label>
            <p className='text-xs text-gray-500 dark:text-gray-400 mb-2'>
              用户两次求片之间的最小间隔时间，默认3600秒（1小时�?            </p>
            <input
              type='number'
              min='0'
              value={movieRequestCooldown}
              onChange={(e) =>
                setMovieRequestCooldown(parseInt(e.target.value) || 0)
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            />
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
              {movieRequestCooldown >= 3600
                ? `�?${Math.floor(
                    movieRequestCooldown / 3600
                  )} 小时 ${Math.floor(
                    (movieRequestCooldown % 3600) / 60
                  )} 分钟`
                : movieRequestCooldown >= 60
                ? `�?${Math.floor(movieRequestCooldown / 60)} 分钟`
                : `${movieRequestCooldown} 秒`}
            </p>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className={buttonStyles.primary}
          >
            {savingSettings ? '保存�?..' : '保存设置'}
          </button>
        </div>
      </div>

      {/* 求片列表 */}
      <div className='p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
        <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-4'>
          求片列表
        </h3>
        <div className='flex gap-2 mb-4'>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            待处�?({pendingCount})
          </button>
          <button
            onClick={() => setFilter('fulfilled')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'fulfilled'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            已上�?({fulfilledCount})
          </button>
        </div>

        {loading ? (
          <div className='flex justify-center py-8'>
            <div className='w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin' />
          </div>
        ) : requests.length === 0 ? (
          <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
            暂无求片
          </div>
        ) : (
          <div className='space-y-3'>
            {requests.map((req) => (
              <div
                key={req.id}
                className='p-4 bg-gray-50 dark:bg-gray-800 rounded-lg'
              >
                <div className='flex gap-4'>
                  {req.poster && (
                    <img
                      src={req.poster}
                      alt={req.title}
                      className='w-16 h-24 object-cover rounded'
                    />
                  )}
                  <div className='flex-1'>
                    <h3 className='font-medium text-gray-900 dark:text-gray-100'>
                      {req.title} {req.year && `(${req.year})`}
                    </h3>
                    <p className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
                      求片人数: {req.requestCount} �?                    </p>
                    <p className='text-xs text-gray-500 dark:text-gray-500 mt-1'>
                      {new Date(req.createdAt).toLocaleString('zh-CN')}
                    </p>
                    {req.requestedBy && (
                      <p className='text-xs text-gray-500 dark:text-gray-500 mt-1'>
                        求片用户: {req.requestedBy.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className='flex flex-col gap-2'>
                    {filter === 'pending' && (
                      <button
                        onClick={() => handleFulfill(req.id)}
                        disabled={isLoading(`fulfill_${req.id}`)}
                        className={buttonStyles.successSmall}
                      >
                        {isLoading(`fulfill_${req.id}`)
                          ? '处理�?..'
                          : '标记已上�?}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(req.id)}
                      disabled={isLoading(`delete_${req.id}`)}
                      className={buttonStyles.dangerSmall}
                    >
                      {isLoading(`delete_${req.id}`) ? '删除�?..' : '删除'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

// AI配置组件
const AIConfigComponent = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();

  // 状态管�?  const [enabled, setEnabled] = useState(false);

  // 自定义配�?  const [customApiKey, setCustomApiKey] = useState('');
  const [customBaseURL, setCustomBaseURL] = useState('');
  const [customModel, setCustomModel] = useState('');

  // 决策模型配置
  const [decisionCustomModel, setDecisionCustomModel] = useState('');

  // 联网搜索配置
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [webSearchProvider, setWebSearchProvider] = useState<
    'tavily' | 'serper' | 'serpapi'
  >('tavily');
  const [tavilyApiKey, setTavilyApiKey] = useState('');
  const [serperApiKey, setSerperApiKey] = useState('');
  const [serpApiKey, setSerpApiKey] = useState('');

  // 功能开�?  const [enableHomepageEntry, setEnableHomepageEntry] = useState(true);
  const [enableVideoCardEntry, setEnableVideoCardEntry] = useState(true);
  const [enablePlayPageEntry, setEnablePlayPageEntry] = useState(true);
  const [enableAIComments, setEnableAIComments] = useState(false);

  // 高级设置
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1000);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [enableStreaming, setEnableStreaming] = useState(true);

  // AI默认消息配置
  const [defaultMessageNoVideo, setDefaultMessageNoVideo] = useState('');
  const [defaultMessageWithVideo, setDefaultMessageWithVideo] = useState('');

  // 从配置加载数�?  useEffect(() => {
    if (config?.AIConfig) {
      setEnabled(config.AIConfig.Enabled || false);
      setCustomApiKey(config.AIConfig.CustomApiKey || '');
      setCustomBaseURL(config.AIConfig.CustomBaseURL || '');
      setCustomModel(config.AIConfig.CustomModel || '');
      setDecisionCustomModel(config.AIConfig.DecisionCustomModel || '');
      setEnableWebSearch(config.AIConfig.EnableWebSearch || false);
      setWebSearchProvider(config.AIConfig.WebSearchProvider || 'tavily');
      setTavilyApiKey(config.AIConfig.TavilyApiKey || '');
      setSerperApiKey(config.AIConfig.SerperApiKey || '');
      setSerpApiKey(config.AIConfig.SerpApiKey || '');
      setEnableHomepageEntry(config.AIConfig.EnableHomepageEntry !== false);
      setEnableVideoCardEntry(config.AIConfig.EnableVideoCardEntry !== false);
      setEnablePlayPageEntry(config.AIConfig.EnablePlayPageEntry !== false);
      setEnableAIComments(config.AIConfig.EnableAIComments || false);
      setTemperature(config.AIConfig.Temperature ?? 0.7);
      setMaxTokens(config.AIConfig.MaxTokens ?? 1000);
      setSystemPrompt(config.AIConfig.SystemPrompt || '');
      setEnableStreaming(config.AIConfig.EnableStreaming !== false);
      setDefaultMessageNoVideo(config.AIConfig.DefaultMessageNoVideo || '');
      setDefaultMessageWithVideo(config.AIConfig.DefaultMessageWithVideo || '');
    }
  }, [config]);

  const handleSave = async () => {
    await withLoading('saveAIConfig', async () => {
      try {
        const response = await fetch('/api/admin/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Enabled: enabled,
            Provider: 'custom',
            CustomApiKey: customApiKey,
            CustomBaseURL: customBaseURL,
            CustomModel: customModel,
            EnableDecisionModel: true,
            DecisionProvider: 'custom',
            DecisionCustomModel: decisionCustomModel,
            EnableWebSearch: enableWebSearch,
            WebSearchProvider: webSearchProvider,
            TavilyApiKey: tavilyApiKey,
            SerperApiKey: serperApiKey,
            SerpApiKey: serpApiKey,
            EnableHomepageEntry: enableHomepageEntry,
            EnableVideoCardEntry: enableVideoCardEntry,
            EnablePlayPageEntry: enablePlayPageEntry,
            EnableAIComments: enableAIComments,
            Temperature: temperature,
            MaxTokens: maxTokens,
            SystemPrompt: systemPrompt,
            EnableStreaming: enableStreaming,
            DefaultMessageNoVideo: defaultMessageNoVideo,
            DefaultMessageWithVideo: defaultMessageWithVideo,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '保存失败');
        }

        showSuccess('AI配置保存成功', showAlert);
        await refreshConfig();
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '保存失败',
          showAlert
        );
        throw error;
      }
    });
  };

  return (
    <div className='space-y-6'>
      {/* 使用说明 */}
      <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
        <div className='flex items-center gap-2 mb-2'>
          <svg
            className='w-5 h-5 text-blue-600 dark:text-blue-400'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
            />
          </svg>
          <span className='text-sm font-medium text-blue-800 dark:text-blue-300'>
            使用说明
          </span>
        </div>
        <div className='text-sm text-blue-700 dark:text-blue-400 space-y-1'>
          <p>�?AI问片功能可以让用户通过AI对话获取影视推荐和信息查�?/p>
          <p>�?支持 OpenAI、Claude 和自定义兼容 OpenAI 格式�?API</p>
          <p>�?启用决策模型�?AI会智能判断是否需要联网搜�?豆瓣/TMDB数据</p>
          <p>�?开启联网搜索后,AI可以获取最新的影视资讯和信�?/p>
          <p>�?配置后可在首页、视频卡片和播放页启用AI问片入口</p>
        </div>
      </div>

      {/* 功能开�?*/}
      <div className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
        <div>
          <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
            启用AI问片功能
          </h3>
          <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
            关闭后所有AI问片入口将不可用
          </p>
        </div>
        <label className='relative inline-flex items-center cursor-pointer'>
          <input
            type='checkbox'
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className='sr-only peer'
          />
          <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
        </label>
      </div>

      {/* AI模型配置 */}
      <div className='space-y-4'>
        <h3 className='text-base font-semibold text-gray-900 dark:text-gray-100'>
          AI模型配置
        </h3>
        <p className='text-sm text-gray-500 dark:text-gray-400'>
          请配置兼容OpenAI格式的API
        </p>
        <div className='space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg'>
          <h4 className='text-sm font-semibold text-gray-900 dark:text-gray-100'>
            自定�?API 配置
          </h4>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              API Key <span className='text-red-500'>*</span>
            </label>
            <input
              type='password'
              value={customApiKey}
              onChange={(e) => setCustomApiKey(e.target.value)}
              placeholder='your-api-key'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              Base URL <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              value={customBaseURL}
              onChange={(e) => setCustomBaseURL(e.target.value)}
              placeholder='https://your-api.example.com/v1'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              模型名称 <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder='model-name'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            />
          </div>
        </div>
      </div>

      {/* 决策模型配置 */}
      <div className='space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg'>
        <div>
          <h4 className='text-sm font-semibold text-gray-900 dark:text-gray-100'>
            AI决策模型配置
          </h4>
          <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
            使用AI智能判断是否需要联网搜索、豆瓣或TMDB数据,并优化搜索关键词(复用主模型的API配置)
          </p>
        </div>

        <div className='space-y-3 p-3 bg-purple-50/50 dark:bg-purple-900/10 rounded-lg'>
          <div>
            <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
              决策模型名称
            </label>
            <input
              type='text'
              value={decisionCustomModel}
              onChange={(e) => setDecisionCustomModel(e.target.value)}
              placeholder='gpt-4o-mini (建议使用成本较低的小模型)'
              className='w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            />
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
              留空则使用传统关键词匹配方式,不进行AI决策
            </p>
          </div>
        </div>

        <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3'>
          <p className='text-xs text-blue-700 dark:text-blue-400'>
            💡 <strong>提示:</strong>{' '}
            决策模型用于智能判断是否需要调用各个数据源,建议使用成本较低的小模型(�?            gpt-4o-mini)。会复用主模型的API Key和Base URL配置�?          </p>
        </div>
      </div>

      {/* 联网搜索配置 */}
      <div className='space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg'>
        <div className='flex items-center justify-between'>
          <div>
            <h4 className='text-sm font-semibold text-gray-900 dark:text-gray-100'>
              启用联网搜索
            </h4>
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
              AI可以搜索最新的影视资讯和信�?            </p>
          </div>
          <label className='relative inline-flex items-center cursor-pointer'>
            <input
              type='checkbox'
              checked={enableWebSearch}
              onChange={(e) => setEnableWebSearch(e.target.checked)}
              className='sr-only peer'
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {enableWebSearch && (
          <div className='space-y-4 mt-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                搜索服务提供�?              </label>
              <select
                value={webSearchProvider}
                onChange={(e) => setWebSearchProvider(e.target.value as any)}
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              >
                <option value='tavily'>Tavily (推荐)</option>
                <option value='serper'>Serper.dev</option>
                <option value='serpapi'>SerpAPI</option>
              </select>
            </div>

            {webSearchProvider === 'tavily' && (
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  Tavily API Key
                </label>
                <input
                  type='password'
                  value={tavilyApiKey}
                  onChange={(e) => setTavilyApiKey(e.target.value)}
                  placeholder='tvly-...'
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                />
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  在{' '}
                  <a
                    href='https://tavily.com'
                    target='_blank'
                    className='text-blue-600 hover:underline'
                  >
                    tavily.com
                  </a>{' '}
                  注册获取
                </p>
              </div>
            )}

            {webSearchProvider === 'serper' && (
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  Serper API Key
                </label>
                <input
                  type='password'
                  value={serperApiKey}
                  onChange={(e) => setSerperApiKey(e.target.value)}
                  placeholder='your-serper-key'
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                />
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  在{' '}
                  <a
                    href='https://serper.dev'
                    target='_blank'
                    className='text-blue-600 hover:underline'
                  >
                    serper.dev
                  </a>{' '}
                  注册获取
                </p>
              </div>
            )}

            {webSearchProvider === 'serpapi' && (
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  SerpAPI Key
                </label>
                <input
                  type='password'
                  value={serpApiKey}
                  onChange={(e) => setSerpApiKey(e.target.value)}
                  placeholder='your-serpapi-key'
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                />
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  在{' '}
                  <a
                    href='https://serpapi.com'
                    target='_blank'
                    className='text-blue-600 hover:underline'
                  >
                    serpapi.com
                  </a>{' '}
                  注册获取
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 入口开�?*/}
      <div className='space-y-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg'>
        <h4 className='text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3'>
          功能入口设置
        </h4>

        {[
          {
            key: 'homepage',
            label: '首页入口',
            desc: '在首页显示AI问片入口',
            state: enableHomepageEntry,
            setState: setEnableHomepageEntry,
          },
          {
            key: 'videocard',
            label: '视频卡片入口',
            desc: '在视频卡片菜单中显示AI问片选项',
            state: enableVideoCardEntry,
            setState: setEnableVideoCardEntry,
          },
          {
            key: 'playpage',
            label: '播放页入�?,
            desc: '在视频播放页显示AI问片功能',
            state: enablePlayPageEntry,
            setState: setEnablePlayPageEntry,
          },
          {
            key: 'aicomments',
            label: 'AI评论功能',
            desc: '在播放页生成AI评论（独立于豆瓣评论�?,
            state: enableAIComments,
            setState: setEnableAIComments,
          },
        ].map((item) => (
          <div
            key={item.key}
            className='flex items-center justify-between py-2'
          >
            <div>
              <div className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                {item.label}
              </div>
              <div className='text-xs text-gray-500 dark:text-gray-400'>
                {item.desc}
              </div>
            </div>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={item.state}
                onChange={(e) => item.setState(e.target.checked)}
                className='sr-only peer'
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
            </label>
          </div>
        ))}
      </div>

      {/* 高级设置 */}
      <details className='p-4 border border-gray-200 dark:border-gray-700 rounded-lg'>
        <summary className='text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer'>
          高级设置 (可�?
        </summary>
        <div className='mt-4 space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              Temperature ({temperature})
            </label>
            <input
              type='range'
              min='0'
              max='2'
              step='0.1'
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className='w-full'
            />
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
              控制回复的创造性，0=保守�?=创�?            </p>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              最大回复Token�?            </label>
            <input
              type='number'
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1000)}
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              自定义系统提示词
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
              placeholder='可自定义AI的角色和行为规则...'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            />
          </div>

          {/* 流式响应开�?*/}
          <div className='flex items-center justify-between py-3 border-t border-gray-200 dark:border-gray-700'>
            <div className='flex-1'>
              <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                流式响应
              </label>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                启用后AI消息将实时流式显示，关闭后将等待完整响应后一次性显�?              </p>
            </div>
            <button
              onClick={() => setEnableStreaming(!enableStreaming)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enableStreaming ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enableStreaming ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </details>

      {/* AI默认消息配置 */}
      <details className='p-4 border border-gray-200 dark:border-gray-700 rounded-lg'>
        <summary className='text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer'>
          默认消息配置 (可�?
        </summary>
        <div className='mt-4 space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              无视频时的默认消�?            </label>
            <textarea
              value={defaultMessageNoVideo}
              onChange={(e) => setDefaultMessageNoVideo(e.target.value)}
              rows={3}
              placeholder='例如：你好！我是KuroTVPlus的AI影视助手。想看什么电影或剧集？需要推荐吗�?
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            />
            <p className='mt-2 text-sm text-gray-600 dark:text-gray-400'>
              当用户在首页或没有视频上下文时打开AI问片，将显示此默认消�?            </p>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              有视频时的默认消�?            </label>
            <textarea
              value={defaultMessageWithVideo}
              onChange={(e) => setDefaultMessageWithVideo(e.target.value)}
              rows={3}
              placeholder='例如：你好！我看到你正在浏览《{title}》，有什么想了解的吗�?
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            />
            <p className='mt-2 text-sm text-gray-600 dark:text-gray-400'>
              当用户在视频卡片或播放页打开AI问片时，将显示此默认消息。支持使用{' '}
              <code className='px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono'>
                {'{title}'}
              </code>{' '}
              替换符来显示片名
            </p>
          </div>
        </div>
      </details>

      {/* 保存按钮 */}
      <div className='flex justify-end'>
        <button
          onClick={handleSave}
          disabled={isLoading('saveAIConfig')}
          className={
            isLoading('saveAIConfig')
              ? buttonStyles.disabled
              : buttonStyles.success
          }
        >
          {isLoading('saveAIConfig') ? '保存�?..' : '保存配置'}
        </button>
      </div>

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

// 音乐配置组件
const MusicConfigComponent = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [enabled, setEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [proxyEnabled, setProxyEnabled] = useState(true);

  useEffect(() => {
    if (config?.MusicConfig) {
      setEnabled(config.MusicConfig.Enabled || false);
      setBaseUrl(config.MusicConfig.BaseUrl || '');
      setToken(config.MusicConfig.Token || '');
      setProxyEnabled(config.MusicConfig.ProxyEnabled ?? true);
    }
  }, [config]);

  const handleSave = async () => {
    await withLoading('saveMusicConfig', async () => {
      try {
        const normalizedBaseUrl = baseUrl.trim().replace(/\/$/, '');

        if (enabled && !normalizedBaseUrl) {
          throw new Error('启用音乐功能时必须填�?lxserver 地址');
        }

        const response = await fetch('/api/admin/music', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Enabled: enabled,
            BaseUrl: normalizedBaseUrl,
            Token: token.trim(),
            ProxyEnabled: proxyEnabled,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '保存失败');
        }

        showSuccess('音乐配置保存成功', showAlert);
        await refreshConfig();
      } catch (error) {
        showError(
          error instanceof Error ? error.message : '保存失败',
          showAlert
        );
        throw error;
      }
    });
  };

  return (
    <div className='space-y-6'>
      <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
        <div className='flex items-center gap-2 mb-2'>
          <svg
            className='w-5 h-5 text-blue-600 dark:text-blue-400'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3'
            />
          </svg>
          <span className='text-sm font-medium text-blue-800 dark:text-blue-300'>
            使用说明
          </span>
        </div>
        <div className='text-sm text-blue-700 dark:text-blue-400 space-y-1'>
          <p>
            �?音乐功能基于 lxserver 提供搜索、热搜、榜单、歌词与播放解析能力
          </p>
          <p>
            �?建议填写服务�?Base URL 与持�?Token，由 MoonTV 服务端代为访�?            lxserver
          </p>
          <p>
            �?项目地址�?            <a
              href='https://github.com/XCQ0607/lxserver'
              target='_blank'
              rel='noreferrer'
              className='underline hover:text-blue-500'
            >
              https://github.com/XCQ0607/lxserver
            </a>
          </p>
        </div>
      </div>

      <div className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
        <div>
          <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
            启用音乐功能
          </h3>
          <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
            关闭后不显示音乐入口，前端音乐页与接口将不可�?          </p>
        </div>
        <label className='relative inline-flex items-center cursor-pointer'>
          <input
            type='checkbox'
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className='sr-only peer'
          />
          <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
        </label>
      </div>

      <div className='space-y-4'>
        <div className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
          <div>
            <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
              启用播放代理
            </h3>
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
              开启后走服务器代理并设置浏览器永久缓存，关闭后将每次都解析播放链接
            </p>
          </div>
          <label className='relative inline-flex items-center cursor-pointer'>
            <input
              type='checkbox'
              checked={proxyEnabled}
              onChange={(e) => setProxyEnabled(e.target.checked)}
              className='sr-only peer'
            />
            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
          </label>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            lxserver Base URL
          </label>
          <input
            type='text'
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder='http://127.0.0.1:9527'
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
          />
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            例如�?http://127.0.0.1:9527 �?https://music.example.com
          </p>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            x-user-token
          </label>
          <input
            type='password'
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder='lx_tk_xxx'
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
          />
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            推荐填写 lxserver 持久 Token；留空则按匿名访问处�?          </p>
        </div>
      </div>

      <div className='flex justify-end'>
        <button
          onClick={handleSave}
          disabled={isLoading('saveMusicConfig')}
          className={
            isLoading('saveMusicConfig')
              ? buttonStyles.disabled
              : buttonStyles.success
          }
        >
          {isLoading('saveMusicConfig') ? '保存�?..' : '保存音乐配置'}
        </button>
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

// 直播源配置组�?const LiveSourceConfig = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [liveSources, setLiveSources] = useState<LiveDataSource[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLiveSource, setEditingLiveSource] =
    useState<LiveDataSource | null>(null);
  const [orderChanged, setOrderChanged] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshIntervalHours, setRefreshIntervalHours] = useState(12);
  const [newLiveSource, setNewLiveSource] = useState<LiveDataSource>({
    name: '',
    key: '',
    url: '',
    ua: '',
    epg: '',
    disabled: false,
    from: 'custom',
  });

  // dnd-kit 传感�?  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 轻微位移即可触发
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 长按 150ms 后触发，避免与滚动冲�?        tolerance: 5,
      },
    })
  );

  // 初始�?  useEffect(() => {
    if (config?.LiveConfig) {
      setLiveSources(config.LiveConfig);
      setRefreshIntervalHours(config.LiveRefreshIntervalHours || 12);
      // 进入时重�?orderChanged
      setOrderChanged(false);
    }
  }, [config]);

  // 通用 API 请求
  const callLiveSourceApi = async (body: Record<string, any>) => {
    try {
      const resp = await fetch('/api/admin/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `操作失败: ${resp.status}`);
      }

      // 成功后刷新配�?      await refreshConfig();
    } catch (err) {
      showError(err instanceof Error ? err.message : '操作失败', showAlert);
      throw err; // 向上抛出方便调用处判�?    }
  };

  const handleToggleEnable = (key: string) => {
    const target = liveSources.find((s) => s.key === key);
    if (!target) return;
    const action = target.disabled ? 'enable' : 'disable';
    withLoading(`toggleLiveSource_${key}`, () =>
      callLiveSourceApi({ action, key })
    ).catch(() => {
      console.error('操作失败', action, key);
    });
  };

  const handleSetProxyMode = (
    key: string,
    mode: 'full' | 'm3u8-only' | 'direct'
  ) => {
    withLoading(`setLiveProxyMode_${key}`, async () => {
      // 保存旧值用于回�?      const oldMode = liveSources.find((s) => s.key === key)?.proxyMode;

      // 乐观更新本地状�?      setLiveSources((prev) =>
        prev.map((s) => (s.key === key ? { ...s, proxyMode: mode } : s))
      );

      try {
        const response = await fetch('/api/admin/live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'set_proxy_mode',
            key,
            proxyMode: mode,
          }),
        });

        if (!response.ok) {
          throw new Error('设置代理模式失败');
        }

        // 成功后刷新配�?        await refreshConfig();
      } catch (error) {
        // 失败时回滚本地状�?        setLiveSources((prev) =>
          prev.map((s) => (s.key === key ? { ...s, proxyMode: oldMode } : s))
        );
        showError(
          error instanceof Error ? error.message : '设置代理模式失败',
          showAlert
        );
        throw error;
      }
    }).catch(() => {
      console.error('操作失败', 'set_proxy_mode', key);
    });
  };

  const handleDelete = (key: string) => {
    withLoading(`deleteLiveSource_${key}`, () =>
      callLiveSourceApi({ action: 'delete', key })
    ).catch(() => {
      console.error('操作失败', 'delete', key);
    });
  };

  // 刷新直播�?  const handleSaveRefreshInterval = () => {
    withLoading('saveLiveRefreshInterval', async () => {
      if (!config) return;

      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          LiveRefreshIntervalHours: Math.max(1, refreshIntervalHours || 12),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `保存失败: ${response.status}`);
      }

      await refreshConfig();
      showAlert({
        type: 'success',
        title: '保存成功',
        message: '电视直播刷新间隔已保�?,
        timer: 2000,
      });
    }).catch((err) => {
      showError(err instanceof Error ? err.message : '保存失败', showAlert);
    });
  };

  const handleRefreshLiveSources = async () => {
    if (isRefreshing) return;

    await withLoading('refreshLiveSources', async () => {
      setIsRefreshing(true);
      try {
        const response = await fetch('/api/admin/live/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `刷新失败: ${response.status}`);
        }

        // 刷新成功后重新获取配�?        await refreshConfig();
        showAlert({
          type: 'success',
          title: '刷新成功',
          message: '直播源已刷新',
          timer: 2000,
        });
      } catch (err) {
        showError(err instanceof Error ? err.message : '刷新失败', showAlert);
        throw err;
      } finally {
        setIsRefreshing(false);
      }
    });
  };

  const handleAddLiveSource = () => {
    if (!newLiveSource.name || !newLiveSource.key || !newLiveSource.url) return;
    withLoading('addLiveSource', async () => {
      await callLiveSourceApi({
        action: 'add',
        key: newLiveSource.key,
        name: newLiveSource.name,
        url: newLiveSource.url,
        ua: newLiveSource.ua,
        epg: newLiveSource.epg,
      });
      setNewLiveSource({
        name: '',
        key: '',
        url: '',
        epg: '',
        ua: '',
        disabled: false,
        from: 'custom',
      });
      setShowAddForm(false);
    }).catch(() => {
      console.error('操作失败', 'add', newLiveSource);
    });
  };

  const handleEditLiveSource = () => {
    if (!editingLiveSource || !editingLiveSource.name || !editingLiveSource.url)
      return;
    withLoading('editLiveSource', async () => {
      await callLiveSourceApi({
        action: 'edit',
        key: editingLiveSource.key,
        name: editingLiveSource.name,
        url: editingLiveSource.url,
        ua: editingLiveSource.ua,
        epg: editingLiveSource.epg,
      });
      setEditingLiveSource(null);
    }).catch(() => {
      console.error('操作失败', 'edit', editingLiveSource);
    });
  };

  const handleCancelEdit = () => {
    setEditingLiveSource(null);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = liveSources.findIndex((s) => s.key === active.id);
    const newIndex = liveSources.findIndex((s) => s.key === over.id);
    setLiveSources((prev) => arrayMove(prev, oldIndex, newIndex));
    setOrderChanged(true);
  };

  const handleSaveOrder = () => {
    const order = liveSources.map((s) => s.key);
    withLoading('saveLiveSourceOrder', () =>
      callLiveSourceApi({ action: 'sort', order })
    )
      .then(() => {
        setOrderChanged(false);
      })
      .catch(() => {
        console.error('操作失败', 'sort', order);
      });
  };

  // 可拖拽行封装 (dnd-kit)
  const DraggableRow = ({ liveSource }: { liveSource: LiveDataSource }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: liveSource.key });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    } as React.CSSProperties;

    return (
      <tr
        ref={setNodeRef}
        style={style}
        className='hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors select-none'
      >
        <td
          className='px-2 py-4 cursor-grab text-gray-400'
          style={{ touchAction: 'none' }}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
          {liveSource.name}
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
          {liveSource.key}
        </td>
        <td
          className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 max-w-[12rem] truncate'
          title={liveSource.url}
        >
          {liveSource.url}
        </td>
        <td
          className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 max-w-[8rem] truncate'
          title={liveSource.epg || '-'}
        >
          {liveSource.epg || '-'}
        </td>
        <td
          className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 max-w-[8rem] truncate'
          title={liveSource.ua || '-'}
        >
          {liveSource.ua || '-'}
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-center'>
          {liveSource.channelNumber && liveSource.channelNumber > 0
            ? liveSource.channelNumber
            : '-'}
        </td>
        <td className='px-6 py-4 whitespace-nowrap max-w-[1rem]'>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              !liveSource.disabled
                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
            }`}
          >
            {!liveSource.disabled ? '启用�? : '已禁�?}
          </span>
        </td>
        <td className='px-6 py-4 whitespace-nowrap'>
          <select
            value={liveSource.proxyMode || 'full'}
            onChange={(e) => {
              handleSetProxyMode(
                liveSource.key,
                e.target.value as 'full' | 'm3u8-only' | 'direct'
              );
            }}
            disabled={isLoading(`setLiveProxyMode_${liveSource.key}`)}
            className={`px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
              isLoading(`setLiveProxyMode_${liveSource.key}`)
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer'
            }`}
          >
            <option value='full'>全量代理</option>
            <option value='m3u8-only'>仅代理m3u8</option>
            <option value='direct'>直连</option>
          </select>
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
          <button
            onClick={() => handleToggleEnable(liveSource.key)}
            disabled={isLoading(`toggleLiveSource_${liveSource.key}`)}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
              !liveSource.disabled
                ? buttonStyles.roundedDanger
                : buttonStyles.roundedSuccess
            } transition-colors ${
              isLoading(`toggleLiveSource_${liveSource.key}`)
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            {!liveSource.disabled ? '禁用' : '启用'}
          </button>
          {liveSource.from !== 'config' && (
            <>
              <button
                onClick={() => setEditingLiveSource(liveSource)}
                disabled={isLoading(`editLiveSource_${liveSource.key}`)}
                className={`${buttonStyles.roundedPrimary} ${
                  isLoading(`editLiveSource_${liveSource.key}`)
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                编辑
              </button>
              <button
                onClick={() => handleDelete(liveSource.key)}
                disabled={isLoading(`deleteLiveSource_${liveSource.key}`)}
                className={`${buttonStyles.roundedSecondary} ${
                  isLoading(`deleteLiveSource_${liveSource.key}`)
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                删除
              </button>
            </>
          )}
        </td>
      </tr>
    );
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载�?..
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 添加直播源表�?*/}
      <div className='space-y-4'>
        <div className='flex items-end justify-between gap-3'>
          <div className='flex items-end gap-2 flex-nowrap'>
            <div className='min-w-0'>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 whitespace-nowrap'>
                刷新间隔（小时）
              </label>
              <input
                type='number'
                min='1'
                value={refreshIntervalHours}
                onChange={(e) =>
                  setRefreshIntervalHours(
                    Math.max(1, parseInt(e.target.value) || 12)
                  )
                }
                className='px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-28 sm:w-40'
              />
            </div>
            <button
              onClick={handleSaveRefreshInterval}
              disabled={isLoading('saveLiveRefreshInterval')}
              className={`px-3 py-1.5 text-sm whitespace-nowrap shrink-0 ${
                isLoading('saveLiveRefreshInterval')
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('saveLiveRefreshInterval') ? '保存�?..' : '保存间隔'}
            </button>
          </div>
        </div>
        <div className='flex items-center justify-between'>
          <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
            直播源列�?          </h4>
          <div className='flex items-center space-x-2'>
            <button
              onClick={handleRefreshLiveSources}
              disabled={isRefreshing || isLoading('refreshLiveSources')}
              className={`px-3 py-1.5 text-sm font-medium flex items-center space-x-2 ${
                isRefreshing || isLoading('refreshLiveSources')
                  ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white rounded-lg'
                  : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg transition-colors'
              }`}
            >
              <span>
                {isRefreshing || isLoading('refreshLiveSources')
                  ? '刷新�?..'
                  : '刷新直播�?}
              </span>
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className={`${
                showAddForm ? buttonStyles.secondary : buttonStyles.success
              } shrink-0 whitespace-nowrap`}
            >
              {showAddForm ? '取消' : '添加直播�?}
            </button>
          </div>
        </div>
      </div>

      {showAddForm && (
        <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <input
              type='text'
              placeholder='名称'
              value={newLiveSource.name}
              onChange={(e) =>
                setNewLiveSource((prev) => ({ ...prev, name: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='Key'
              value={newLiveSource.key}
              onChange={(e) =>
                setNewLiveSource((prev) => ({ ...prev, key: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='M3U 地址'
              value={newLiveSource.url}
              onChange={(e) =>
                setNewLiveSource((prev) => ({ ...prev, url: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='节目单地址（选填�?
              value={newLiveSource.epg}
              onChange={(e) =>
                setNewLiveSource((prev) => ({ ...prev, epg: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='自定�?UA（选填�?
              value={newLiveSource.ua}
              onChange={(e) =>
                setNewLiveSource((prev) => ({ ...prev, ua: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>
          <div className='flex justify-end'>
            <button
              onClick={handleAddLiveSource}
              disabled={
                !newLiveSource.name ||
                !newLiveSource.key ||
                !newLiveSource.url ||
                isLoading('addLiveSource')
              }
              className={`w-full sm:w-auto px-4 py-2 ${
                !newLiveSource.name ||
                !newLiveSource.key ||
                !newLiveSource.url ||
                isLoading('addLiveSource')
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('addLiveSource') ? '添加�?..' : '添加'}
            </button>
          </div>
        </div>
      )}

      {/* 编辑直播源表�?*/}
      {editingLiveSource && (
        <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4'>
          <div className='flex items-center justify-between'>
            <h5 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              编辑直播�? {editingLiveSource.name}
            </h5>
            <button
              onClick={handleCancelEdit}
              className='text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            >
              �?            </button>
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                名称
              </label>
              <input
                type='text'
                value={editingLiveSource.name}
                onChange={(e) =>
                  setEditingLiveSource((prev) =>
                    prev ? { ...prev, name: e.target.value } : null
                  )
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                Key (不可编辑)
              </label>
              <input
                type='text'
                value={editingLiveSource.key}
                disabled
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                M3U 地址
              </label>
              <input
                type='text'
                value={editingLiveSource.url}
                onChange={(e) =>
                  setEditingLiveSource((prev) =>
                    prev ? { ...prev, url: e.target.value } : null
                  )
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                节目单地址（选填�?              </label>
              <input
                type='text'
                value={editingLiveSource.epg}
                onChange={(e) =>
                  setEditingLiveSource((prev) =>
                    prev ? { ...prev, epg: e.target.value } : null
                  )
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                自定�?UA（选填�?              </label>
              <input
                type='text'
                value={editingLiveSource.ua}
                onChange={(e) =>
                  setEditingLiveSource((prev) =>
                    prev ? { ...prev, ua: e.target.value } : null
                  )
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
          </div>
          <div className='flex justify-end space-x-2'>
            <button
              onClick={handleCancelEdit}
              className={buttonStyles.secondary}
            >
              取消
            </button>
            <button
              onClick={handleEditLiveSource}
              disabled={
                !editingLiveSource.name ||
                !editingLiveSource.url ||
                isLoading('editLiveSource')
              }
              className={`${
                !editingLiveSource.name ||
                !editingLiveSource.url ||
                isLoading('editLiveSource')
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('editLiveSource') ? '保存�?..' : '保存'}
            </button>
          </div>
        </div>
      )}

      {/* 直播源表�?*/}
      <div
        className='border border-gray-200 dark:border-gray-700 rounded-lg max-h-[28rem] overflow-y-auto overflow-x-auto relative'
        data-table='live-source-list'
      >
        <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
          <thead className='bg-gray-50 dark:bg-gray-900 sticky top-0 z-10'>
            <tr>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                名称
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                Key
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                M3U 地址
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                节目单地址
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                自定�?UA
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                频道�?              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                状�?              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                代理模式
              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                操作
              </th>
            </tr>
          </thead>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            autoScroll={false}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          >
            <SortableContext
              items={liveSources.map((s) => s.key)}
              strategy={verticalListSortingStrategy}
            >
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {liveSources.map((liveSource) => (
                  <DraggableRow key={liveSource.key} liveSource={liveSource} />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      {/* 保存排序按钮 */}
      {orderChanged && (
        <div className='flex justify-end'>
          <button
            onClick={handleSaveOrder}
            disabled={isLoading('saveLiveSourceOrder')}
            className={`px-3 py-1.5 text-sm ${
              isLoading('saveLiveSourceOrder')
                ? buttonStyles.disabled
                : buttonStyles.primary
            }`}
          >
            {isLoading('saveLiveSourceOrder') ? '保存�?..' : '保存排序'}
          </button>
        </div>
      )}

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

// 网络直播配置组件
const WebLiveConfig = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [webLiveSources, setWebLiveSources] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSource, setEditingSource] = useState<any | null>(null);
  const [newSource, setNewSource] = useState({
    name: '',
    platform: 'huya',
    roomId: '',
  });
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [isEnabling, setIsEnabling] = useState(false);

  useEffect(() => {
    if (config?.WebLiveConfig) {
      setWebLiveSources(config.WebLiveConfig);
    }
  }, [config]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showDisclaimerModal && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [showDisclaimerModal, countdown]);

  const callApi = async (body: Record<string, any>) => {
    try {
      const resp = await fetch('/api/admin/web-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `操作失败: ${resp.status}`);
      }
      await refreshConfig();
    } catch (err) {
      showError(err instanceof Error ? err.message : '操作失败', showAlert);
      throw err;
    }
  };

  const handleAdd = () => {
    if (!newSource.name || !newSource.platform || !newSource.roomId) return;
    withLoading('addWebLive', async () => {
      await callApi({
        action: 'add',
        name: newSource.name,
        platform: newSource.platform,
        roomId: newSource.roomId,
      });
      setNewSource({ name: '', platform: 'huya', roomId: '' });
      setShowAddForm(false);
    }).catch(() => {});
  };

  const handleEdit = () => {
    if (!editingSource || !editingSource.name || !editingSource.roomId) return;
    withLoading('editWebLive', async () => {
      await callApi({
        action: 'edit',
        key: editingSource.key,
        name: editingSource.name,
        platform: editingSource.platform,
        roomId: editingSource.roomId,
      });
      setEditingSource(null);
    }).catch(() => {});
  };

  const handleToggle = (key: string) => {
    const target = webLiveSources.find((s) => s.key === key);
    if (!target) return;
    const action = target.disabled ? 'enable' : 'disable';
    withLoading(`toggleWebLive_${key}`, () => callApi({ action, key })).catch(
      () => {}
    );
  };

  const handleDelete = (key: string) => {
    withLoading(`deleteWebLive_${key}`, () =>
      callApi({ action: 'delete', key })
    ).catch(() => {});
  };

  const handleToggleWebLiveEnabled = async () => {
    const currentEnabled = config?.WebLiveEnabled ?? false;

    if (!currentEnabled) {
      setShowDisclaimerModal(true);
      setCountdown(10);
    } else {
      await withLoading('toggleWebLiveEnabled', async () => {
        await callApi({ action: 'toggleEnabled', enabled: false });
      }).catch(() => {});
    }
  };

  const handleConfirmEnable = async () => {
    setIsEnabling(true);
    try {
      await callApi({ action: 'toggleEnabled', enabled: true });
      setShowDisclaimerModal(false);
      setCountdown(10);
    } catch (err) {
      // Error already handled by callApi
    } finally {
      setIsEnabling(false);
    }
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载�?..
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 功能总开�?*/}
      <div className='p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg border-2 border-orange-300 dark:border-orange-700'>
        <div className='flex items-center justify-between'>
          <div className='flex-1'>
            <h4 className='text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1'>
              网络直播功能总开�?            </h4>
            <p className='text-xs text-gray-600 dark:text-gray-400'>
              关闭后，侧边栏和底部导航栏的网络直播入口将被隐藏，用户无法访问网络直播页�?            </p>
          </div>
          <button
            onClick={handleToggleWebLiveEnabled}
            disabled={isLoading('toggleWebLiveEnabled')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
              config.WebLiveEnabled
                ? buttonStyles.toggleOn
                : buttonStyles.toggleOff
            } ${
              isLoading('toggleWebLiveEnabled')
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                buttonStyles.toggleThumb
              } ${
                config.WebLiveEnabled
                  ? buttonStyles.toggleThumbOn
                  : buttonStyles.toggleThumbOff
              }`}
            />
          </button>
        </div>
      </div>

      {/* 免责声明弹窗 */}
      {showDisclaimerModal &&
        createPortal(
          <div className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'>
            <div className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full border border-red-200 dark:border-red-800'>
              <div className='p-6'>
                <div className='flex justify-center mb-4'>
                  <AlertTriangle className='w-12 h-12 text-red-500' />
                </div>

                <h3 className='text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 text-center'>
                  免责声明
                </h3>

                <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6'>
                  <p className='text-sm text-gray-700 dark:text-gray-300 leading-relaxed'>
                    本功能仅供个人学习和技术研究使用，请勿将其部署在公网环境中，更不得用于任何违法违规行为�?                    使用本功能所产生的一切法律责任由使用者自行承担，与开发者无关�?                    启用此功能即表示您已充分理解并同意承担相应风险�?                  </p>
                </div>

                <div className='flex gap-3 justify-center'>
                  <button
                    onClick={() => {
                      setShowDisclaimerModal(false);
                      setCountdown(10);
                    }}
                    className={buttonStyles.secondary}
                    disabled={isEnabling}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmEnable}
                    disabled={countdown > 0 || isEnabling}
                    className={
                      countdown > 0 || isEnabling
                        ? buttonStyles.disabled
                        : buttonStyles.danger
                    }
                  >
                    {isEnabling
                      ? '启用�?..'
                      : countdown > 0
                      ? `确认 (${countdown}s)`
                      : '确认启用'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      <div className='flex items-center justify-between'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
          网络直播列表
        </h4>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={
            showAddForm ? buttonStyles.secondary : buttonStyles.success
          }
        >
          {showAddForm ? '取消' : '添加网络直播'}
        </button>
      </div>

      {showAddForm && (
        <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <input
              type='text'
              placeholder='名称'
              value={newSource.name}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, name: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <select
              value={newSource.platform}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, platform: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            >
              <option value='huya'>虎牙</option>
              <option value='bilibili'>哔哩哔哩</option>
              <option value='douyin'>抖音</option>
            </select>
            <input
              type='text'
              placeholder='房间ID'
              value={newSource.roomId}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, roomId: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>
          <div className='flex justify-end'>
            <button
              onClick={handleAdd}
              disabled={
                !newSource.name ||
                !newSource.platform ||
                !newSource.roomId ||
                isLoading('addWebLive')
              }
              className={`w-full sm:w-auto px-4 py-2 ${
                !newSource.name ||
                !newSource.platform ||
                !newSource.roomId ||
                isLoading('addWebLive')
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('addWebLive') ? '添加�?..' : '添加'}
            </button>
          </div>
        </div>
      )}

      {editingSource && (
        <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4'>
          <div className='flex items-center justify-between'>
            <h5 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              编辑: {editingSource.name}
            </h5>
            <button
              onClick={() => setEditingSource(null)}
              className='text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            >
              �?            </button>
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                名称
              </label>
              <input
                type='text'
                value={editingSource.name}
                onChange={(e) =>
                  setEditingSource((prev: any) =>
                    prev ? { ...prev, name: e.target.value } : null
                  )
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                直播类型
              </label>
              <select
                value={editingSource.platform}
                onChange={(e) =>
                  setEditingSource((prev: any) =>
                    prev ? { ...prev, platform: e.target.value } : null
                  )
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              >
                <option value='huya'>虎牙</option>
                <option value='bilibili'>哔哩哔哩</option>
                <option value='douyin'>抖音</option>
              </select>
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                房间ID
              </label>
              <input
                type='text'
                value={editingSource.roomId}
                onChange={(e) =>
                  setEditingSource((prev: any) =>
                    prev ? { ...prev, roomId: e.target.value } : null
                  )
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
          </div>
          <div className='flex justify-end space-x-2'>
            <button
              onClick={() => setEditingSource(null)}
              className={buttonStyles.secondary}
            >
              取消
            </button>
            <button
              onClick={handleEdit}
              disabled={
                !editingSource.name ||
                !editingSource.roomId ||
                isLoading('editWebLive')
              }
              className={`${
                !editingSource.name ||
                !editingSource.roomId ||
                isLoading('editWebLive')
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('editWebLive') ? '保存�?..' : '保存'}
            </button>
          </div>
        </div>
      )}

      <div className='border border-gray-200 dark:border-gray-700 rounded-lg overflow-auto'>
        <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
          <thead className='bg-gray-50 dark:bg-gray-900'>
            <tr>
              <th className='px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase'>
                名称
              </th>
              <th className='hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase'>
                直播类型
              </th>
              <th className='hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase'>
                房间ID
              </th>
              <th className='px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase'>
                状�?              </th>
              <th className='px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase'>
                操作
              </th>
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
            {webLiveSources.map((source) => (
              <tr
                key={source.key}
                className='hover:bg-gray-50 dark:hover:bg-gray-800'
              >
                <td className='px-3 sm:px-6 py-4 text-sm text-gray-900 dark:text-gray-100'>
                  <div>{source.name}</div>
                  <div className='sm:hidden text-xs text-gray-500 dark:text-gray-400 mt-1'>
                    {source.platform === 'huya'
                      ? '虎牙'
                      : source.platform === 'bilibili'
                      ? '哔哩哔哩'
                      : source.platform === 'douyin'
                      ? '抖音'
                      : source.platform}{' '}
                    · {source.roomId}
                  </div>
                </td>
                <td className='hidden sm:table-cell px-6 py-4 text-sm text-gray-900 dark:text-gray-100'>
                  {source.platform === 'huya'
                    ? '虎牙'
                    : source.platform === 'bilibili'
                    ? '哔哩哔哩'
                    : source.platform === 'douyin'
                    ? '抖音'
                    : source.platform}
                </td>
                <td className='hidden sm:table-cell px-6 py-4 text-sm text-gray-900 dark:text-gray-100'>
                  {source.roomId}
                </td>
                <td className='px-3 sm:px-6 py-4 whitespace-nowrap'>
                  <span
                    className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                      !source.disabled
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                        : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                    }`}
                  >
                    {!source.disabled ? '启用�? : '已禁�?}
                  </span>
                </td>
                <td className='px-3 sm:px-6 py-4 text-right text-sm whitespace-nowrap'>
                  <div className='flex flex-col sm:flex-row gap-1 sm:gap-2 items-end sm:items-center justify-end'>
                    <button
                      onClick={() => handleToggle(source.key)}
                      disabled={isLoading(`toggleWebLive_${source.key}`)}
                      className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
                        !source.disabled
                          ? buttonStyles.roundedDanger
                          : buttonStyles.roundedSuccess
                      } ${
                        isLoading(`toggleWebLive_${source.key}`)
                          ? 'opacity-50 cursor-not-allowed'
                          : ''
                      }`}
                    >
                      {!source.disabled ? '禁用' : '启用'}
                    </button>
                    {source.from !== 'config' && (
                      <>
                        <button
                          onClick={() => setEditingSource(source)}
                          disabled={isLoading(`editWebLive_${source.key}`)}
                          className={`${buttonStyles.roundedPrimary} ${
                            isLoading(`editWebLive_${source.key}`)
                              ? 'opacity-50 cursor-not-allowed'
                              : ''
                          }`}
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(source.key)}
                          disabled={isLoading(`deleteWebLive_${source.key}`)}
                          className={`${buttonStyles.roundedSecondary} ${
                            isLoading(`deleteWebLive_${source.key}`)
                              ? 'opacity-50 cursor-not-allowed'
                              : ''
                          }`}
                        >
                          删除
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

function AdminPageClient() {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<'owner' | 'admin' | null>(null);
  const [showResetConfigModal, setShowResetConfigModal] = useState(false);
  const [expandedTabs, setExpandedTabs] = useState<{ [key: string]: boolean }>({
    userConfig: false,
    videoSource: false,
    sourceScriptLab: false,
    musicConfig: false,
    mediaLibrary: false,
    openListConfig: false,
    netDiskConfig: false,
    embyConfig: false,
    xiaoyaConfig: false,
    suwayomiConfig: false,
    opdsConfig: false,
    animeSubscription: false,
    aiConfig: false,
    liveSource: false,
    webLive: false,
    siteConfig: false,
    registrationConfig: false,
    categoryConfig: false,
    configFile: false,
    dataMigration: false,
    customAdFilter: false,
    themeConfig: false,
    emailConfig: false,
  });

  // 获取管理员配�?  // showLoading 用于控制是否在请求期间显示整体加载骨架�?  const fetchConfig = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const response = await fetch(`/api/admin/config`);

      if (!response.ok) {
        const data = (await response.json()) as any;
        throw new Error(`获取配置失败: ${data.error}`);
      }

      const data = (await response.json()) as AdminConfigResult;
      setConfig(data.Config);
      setRole(data.Role);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '获取配置失败';
      // 只在首次加载时设置错误状态，避免弹窗和错误页面同时显�?      if (showLoading) {
        setError(msg);
      } else {
        showError(msg, showAlert);
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  // 新版本用户列表状�?  const [usersV2, setUsersV2] = useState<Array<{
    username: string;
    role: 'owner' | 'admin' | 'user';
    banned: boolean;
    tags?: string[];
    enabledApis?: string[];
    created_at: number;
  }> | null>(null);

  // 用户列表分页状�?  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [userListLoading, setUserListLoading] = useState(false);
  const userLimit = 10;

  // 获取新版本用户列�?  const fetchUsersV2 = useCallback(async (page = 1) => {
    try {
      setUserListLoading(true);
      const response = await fetch(
        `/api/admin/users?page=${page}&limit=${userLimit}`
      );
      if (response.ok) {
        const data = await response.json();
        setUsersV2(data.users);
        setUserTotalPages(data.totalPages || 1);
        setUserTotal(data.total || 0);
        setUserPage(page);
      }
    } catch (err) {
      console.error('获取新版本用户列表失�?', err);
    } finally {
      setUserListLoading(false);
    }
  }, []);

  // 刷新配置和用户列�?  const refreshConfigAndUsers = useCallback(async () => {
    await fetchConfig();
    await fetchUsersV2(userPage); // 保持当前页码
  }, [fetchConfig, fetchUsersV2, userPage]);

  useEffect(() => {
    // 首次加载时显示骨�?    fetchConfig(true);
    // 不再自动获取用户列表，等用户打开用户管理选项卡时再获�?  }, [fetchConfig]);

  // 切换标签展开状�?  const toggleTab = (tabKey: string) => {
    const wasExpanded = expandedTabs[tabKey];

    setExpandedTabs((prev) => ({
      ...prev,
      [tabKey]: !prev[tabKey],
    }));

    // 当打开用户管理选项卡时，如果还没有加载用户列表，则加载
    if (tabKey === 'userConfig' && !wasExpanded && !usersV2) {
      fetchUsersV2();
    }
  };

  // 新增: 重置配置处理函数
  const handleResetConfig = () => {
    setShowResetConfigModal(true);
  };

  const handleConfirmResetConfig = async () => {
    await withLoading('resetConfig', async () => {
      try {
        const response = await fetch(`/api/admin/reset`);
        if (!response.ok) {
          throw new Error(`重置失败: ${response.status}`);
        }
        showSuccess('重置成功，请刷新页面�?, showAlert);
        await fetchConfig();
        setShowResetConfigModal(false);
      } catch (err) {
        showError(err instanceof Error ? err.message : '重置失败', showAlert);
        throw err;
      }
    });
  };

  // 新增: 重载配置处理函数
  const handleReloadConfig = async () => {
    await withLoading('reloadConfig', async () => {
      try {
        const response = await fetch(`/api/admin/reload`);
        if (!response.ok) {
          throw new Error(`重载失败: ${response.status}`);
        }
        showSuccess('重载成功，配置缓存已清除�?, showAlert);
        await fetchConfig();
      } catch (err) {
        showError(err instanceof Error ? err.message : '重载失败', showAlert);
        throw err;
      }
    });
  };

  if (loading) {
    return (
      <PageLayout activePath='/admin'>
        <div className='px-2 sm:px-10 py-4 sm:py-8'>
          <div className='max-w-[95%] mx-auto'>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8'>
              管理员设�?            </h1>
            <div className='space-y-4'>
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className='h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse'
                />
              ))}
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    // 显示无权限提示页�?    return (
      <PageLayout activePath='/admin'>
        <div className='min-h-screen flex items-center justify-center px-4'>
          <div className='max-w-md w-full'>
            <div className='bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center'>
              <div className='mb-6'>
                <div className='mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center'>
                  <AlertCircle className='w-8 h-8 text-red-600 dark:text-red-400' />
                </div>
              </div>
              <h2 className='text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4'>
                无权限访�?              </h2>
              <p className='text-gray-600 dark:text-gray-400 mb-6'>{error}</p>
              <div className='space-y-3'>
                <button
                  onClick={() => (window.location.href = '/')}
                  className='w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg font-medium transition-colors'
                >
                  返回首页
                </button>
                <button
                  onClick={() => (window.location.href = '/login')}
                  className='w-full px-6 py-3 bg-gray-600 hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-700 text-white rounded-lg font-medium transition-colors'
                >
                  重新登录
                </button>
              </div>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activePath='/admin'>
      <div className='px-2 sm:px-10 py-4 sm:py-8'>
        <div className='max-w-[95%] mx-auto'>
          {/* 标题 + 重置配置按钮 */}
          <div className='flex items-center gap-2 mb-8'>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
              管理员设�?            </h1>
            {config && role === 'owner' && (
              <>
                <button
                  onClick={handleResetConfig}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${buttonStyles.dangerSmall}`}
                >
                  重置配置
                </button>
                <button
                  onClick={handleReloadConfig}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${buttonStyles.primarySmall}`}
                >
                  重载配置
                </button>
              </>
            )}
          </div>

          {/* TMDB 未配置提�?*/}
          {config && !config.SiteConfig.TMDBApiKey && (
            <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4'>
              <div className='flex items-start gap-3'>
                <div className='flex-shrink-0 mt-0.5'>
                  <svg
                    className='w-5 h-5 text-blue-600 dark:text-blue-400'
                    fill='currentColor'
                    viewBox='0 0 20 20'
                  >
                    <path
                      fillRule='evenodd'
                      d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
                      clipRule='evenodd'
                    />
                  </svg>
                </div>
                <div className='flex-1'>
                  <p className='text-sm font-medium text-blue-800 dark:text-blue-300'>
                    未配�?TMDB API Key，配置后可获得更丰富的影视信息和推荐内容
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 视频源过多提�?*/}
          {config && (config.SourceConfig?.length ?? 0) > 50 && (
            <div className='bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4'>
              <div className='flex items-start gap-3'>
                <div className='flex-shrink-0 mt-0.5'>
                  <svg
                    className='w-5 h-5 text-amber-600 dark:text-amber-400'
                    fill='currentColor'
                    viewBox='0 0 20 20'
                  >
                    <path
                      fillRule='evenodd'
                      d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.591c.75 1.334-.213 2.99-1.742 2.99H3.48c-1.53 0-2.492-1.656-1.743-2.99L8.257 3.1zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-6a1 1 0 00-1 1v3a1 1 0 102 0V8a1 1 0 00-1-1z'
                      clipRule='evenodd'
                    />
                  </svg>
                </div>
                <div className='flex-1'>
                  <p className='text-sm font-medium text-amber-800 dark:text-amber-300'>
                    当前视频源数量较多，可能会拖慢搜索与优选速度，建议适当精简
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 配置文件标签 - 仅站长可�?*/}
          {role === 'owner' && (
            <CollapsibleTab
              title='配置文件'
              icon={
                <FileText
                  size={20}
                  className='text-gray-600 dark:text-gray-400'
                />
              }
              isExpanded={expandedTabs.configFile}
              onToggle={() => toggleTab('configFile')}
            >
              <ConfigFileComponent
                config={config}
                refreshConfig={fetchConfig}
              />
            </CollapsibleTab>
          )}

          {/* 站点配置标签 */}
          <CollapsibleTab
            title='站点配置'
            icon={
              <Settings
                size={20}
                className='text-gray-600 dark:text-gray-400'
              />
            }
            isExpanded={expandedTabs.siteConfig}
            onToggle={() => toggleTab('siteConfig')}
          >
            <SiteConfigComponent config={config} refreshConfig={fetchConfig} />
          </CollapsibleTab>

          {/* 注册配置标签 */}
          <CollapsibleTab
            title='注册配置'
            icon={
              <UserPlus
                size={20}
                className='text-gray-600 dark:text-gray-400'
              />
            }
            isExpanded={expandedTabs.registrationConfig}
            onToggle={() => toggleTab('registrationConfig')}
          >
            <RegistrationConfigComponent
              config={config}
              refreshConfig={fetchConfig}
            />
          </CollapsibleTab>

          {/* 个性化配置标签 */}
          <CollapsibleTab
            title='个性化配置'
            icon={
              <Palette size={20} className='text-gray-600 dark:text-gray-400' />
            }
            isExpanded={expandedTabs.themeConfig}
            onToggle={() => toggleTab('themeConfig')}
          >
            <ThemeConfigComponent config={config} refreshConfig={fetchConfig} />
          </CollapsibleTab>

          <div className='space-y-4'>
            {/* 用户配置标签 */}
            <CollapsibleTab
              title='用户配置'
              icon={
                <Users size={20} className='text-gray-600 dark:text-gray-400' />
              }
              isExpanded={expandedTabs.userConfig}
              onToggle={() => toggleTab('userConfig')}
            >
              <UserConfig
                config={config}
                role={role}
                refreshConfig={refreshConfigAndUsers}
                usersV2={usersV2}
                userPage={userPage}
                userTotalPages={userTotalPages}
                userTotal={userTotal}
                fetchUsersV2={fetchUsersV2}
                userListLoading={userListLoading}
              />
            </CollapsibleTab>

            {/* 视频源配置标�?*/}
            <CollapsibleTab
              title='视频源配�?
              icon={
                <Video size={20} className='text-gray-600 dark:text-gray-400' />
              }
              isExpanded={expandedTabs.videoSource}
              onToggle={() => toggleTab('videoSource')}
            >
              <VideoSourceConfig config={config} refreshConfig={fetchConfig} />
            </CollapsibleTab>

            <CollapsibleTab
              title='视频源脚�?
              icon={
                <Bot size={20} className='text-gray-600 dark:text-gray-400' />
              }
              isExpanded={expandedTabs.sourceScriptLab}
              onToggle={() => toggleTab('sourceScriptLab')}
            >
              <VideoSourceScriptLab />
            </CollapsibleTab>

            <CollapsibleTab
              title='音乐配置'
              icon={
                <svg
                  width='20'
                  height='20'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='text-gray-600 dark:text-gray-400'
                >
                  <path d='M9 18V5l12-2v13' />
                  <circle cx='6' cy='18' r='3' />
                  <circle cx='18' cy='16' r='3' />
                </svg>
              }
              isExpanded={expandedTabs.musicConfig}
              onToggle={() => toggleTab('musicConfig')}
            >
              <MusicConfigComponent
                config={config}
                refreshConfig={fetchConfig}
              />
            </CollapsibleTab>

            <CollapsibleTab
              title='漫画配置'
              icon={
                <BookOpen
                  size={20}
                  className='text-gray-600 dark:text-gray-400'
                />
              }
              isExpanded={expandedTabs.suwayomiConfig}
              onToggle={() => toggleTab('suwayomiConfig')}
            >
              <SuwayomiConfigComponent
                config={config}
                refreshConfig={fetchConfig}
              />
            </CollapsibleTab>

            <CollapsibleTab
              title='电子书配�?
              icon={
                <BookMarked
                  size={20}
                  className='text-gray-600 dark:text-gray-400'
                />
              }
              isExpanded={expandedTabs.opdsConfig}
              onToggle={() => toggleTab('opdsConfig')}
            >
              <OPDSConfigComponent
                config={config}
                refreshConfig={fetchConfig}
              />
            </CollapsibleTab>

            {/* 电视直播源配置标�?*/}
            <CollapsibleTab
              title='电视直播源配�?
              icon={
                <Tv size={20} className='text-gray-600 dark:text-gray-400' />
              }
              isExpanded={expandedTabs.liveSource}
              onToggle={() => toggleTab('liveSource')}
            >
              <LiveSourceConfig config={config} refreshConfig={fetchConfig} />
            </CollapsibleTab>

            {/* 网络直播配置标签 */}
            <CollapsibleTab
              title='网络直播配置'
              icon={
                <Globe size={20} className='text-gray-600 dark:text-gray-400' />
              }
              isExpanded={expandedTabs.webLive}
              onToggle={() => toggleTab('webLive')}
            >
              <WebLiveConfig config={config} refreshConfig={fetchConfig} />
            </CollapsibleTab>

            {/* 私人影库大类 */}
            <CollapsibleTab
              title='私人影库'
              icon={
                <Database
                  size={20}
                  className='text-yellow-700 dark:text-yellow-400'
                />
              }
              isExpanded={expandedTabs.mediaLibrary}
              onToggle={() => toggleTab('mediaLibrary')}
              isParent={true}
            >
              <div className='space-y-4'>
                {/* Openlist配置子标�?*/}
                <CollapsibleTab
                  title='Openlist配置'
                  icon={
                    <FolderOpen
                      size={20}
                      className='text-gray-600 dark:text-gray-400'
                    />
                  }
                  isExpanded={expandedTabs.openListConfig}
                  onToggle={() => toggleTab('openListConfig')}
                >
                  <OpenListConfigComponent
                    config={config}
                    refreshConfig={fetchConfig}
                  />
                </CollapsibleTab>

                {/* Emby 媒体库子标签 */}
                <CollapsibleTab
                  title='Emby 媒体�?
                  icon={
                    <FolderOpen
                      size={20}
                      className='text-gray-600 dark:text-gray-400'
                    />
                  }
                  isExpanded={expandedTabs.embyConfig}
                  onToggle={() => toggleTab('embyConfig')}
                >
                  <EmbyConfigComponent
                    config={config}
                    refreshConfig={fetchConfig}
                  />
                </CollapsibleTab>

                {/* 小雅配置子标�?*/}
                <CollapsibleTab
                  title='小雅配置'
                  icon={
                    <FolderOpen
                      size={20}
                      className='text-gray-600 dark:text-gray-400'
                    />
                  }
                  isExpanded={expandedTabs.xiaoyaConfig}
                  onToggle={() => toggleTab('xiaoyaConfig')}
                >
                  <XiaoyaConfigComponent
                    config={config}
                    refreshConfig={fetchConfig}
                  />
                </CollapsibleTab>
                {/* 求片管理子标�?*/}
                <CollapsibleTab
                  title='求片管理'
                  icon={
                    <Video
                      size={20}
                      className='text-gray-600 dark:text-gray-400'
                    />
                  }
                  isExpanded={expandedTabs.movieRequests}
                  onToggle={() => toggleTab('movieRequests')}
                >
                  <MovieRequestsComponent
                    config={config}
                    refreshConfig={fetchConfig}
                  />
                </CollapsibleTab>

                {/* 追番订阅子标�?*/}
                <CollapsibleTab
                  title='追番订阅'
                  icon={
                    <Cat
                      size={20}
                      className='text-gray-600 dark:text-gray-400'
                    />
                  }
                  isExpanded={expandedTabs.animeSubscription}
                  onToggle={() => toggleTab('animeSubscription')}
                >
                  <AnimeSubscriptionComponent
                    config={config}
                    refreshConfig={fetchConfig}
                  />
                </CollapsibleTab>

                <CollapsibleTab
                  title='网盘配置'
                  icon={
                    <Cloud
                      size={20}
                      className='text-gray-600 dark:text-gray-400'
                    />
                  }
                  isExpanded={expandedTabs.netDiskConfig}
                  onToggle={() => toggleTab('netDiskConfig')}
                >
                  <NetDiskConfigComponent
                    config={config}
                    refreshConfig={fetchConfig}
                  />
                </CollapsibleTab>
              </div>
            </CollapsibleTab>

            {/* AI配置标签 */}
            <CollapsibleTab
              title='AI设定'
              icon={
                <Bot size={20} className='text-gray-600 dark:text-gray-400' />
              }
              isExpanded={expandedTabs.aiConfig}
              onToggle={() => toggleTab('aiConfig')}
            >
              <AIConfigComponent config={config} refreshConfig={fetchConfig} />
            </CollapsibleTab>

            {/* 邮件配置标签 */}
            <CollapsibleTab
              title='邮件配置'
              icon={
                <Mail size={20} className='text-gray-600 dark:text-gray-400' />
              }
              isExpanded={expandedTabs.emailConfig}
              onToggle={() => toggleTab('emailConfig')}
            >
              <EmailConfigComponent
                config={config}
                refreshConfig={fetchConfig}
              />
            </CollapsibleTab>

            {/* 分类配置标签 */}
            <CollapsibleTab
              title='分类配置'
              icon={
                <FolderOpen
                  size={20}
                  className='text-gray-600 dark:text-gray-400'
                />
              }
              isExpanded={expandedTabs.categoryConfig}
              onToggle={() => toggleTab('categoryConfig')}
            >
              <CategoryConfig config={config} refreshConfig={fetchConfig} />
            </CollapsibleTab>

            {/* 自定义去广告标签 */}
            <CollapsibleTab
              title='自定义去广告'
              icon={
                <svg
                  width='20'
                  height='20'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='text-gray-600 dark:text-gray-400'
                >
                  <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z' />
                  <path d='M8 12h8' />
                </svg>
              }
              isExpanded={expandedTabs.customAdFilter}
              onToggle={() => toggleTab('customAdFilter')}
            >
              <CustomAdFilterConfig
                config={config}
                refreshConfig={fetchConfig}
              />
            </CollapsibleTab>

            {/* 数据迁移标签 - 仅站长可�?*/}
            {role === 'owner' && (
              <CollapsibleTab
                title='数据迁移'
                icon={
                  <Database
                    size={20}
                    className='text-gray-600 dark:text-gray-400'
                  />
                }
                isExpanded={expandedTabs.dataMigration}
                onToggle={() => toggleTab('dataMigration')}
              >
                <DataMigration onRefreshConfig={refreshConfigAndUsers} />
              </CollapsibleTab>
            )}
          </div>
        </div>
      </div>

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />

      {/* 重置配置确认弹窗 */}
      {showResetConfigModal &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => setShowResetConfigModal(false)}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    确认重置配置
                  </h3>
                  <button
                    onClick={() => setShowResetConfigModal(false)}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='mb-6'>
                  <div className='bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4'>
                    <div className='flex items-center space-x-2 mb-2'>
                      <svg
                        className='w-5 h-5 text-yellow-600 dark:text-yellow-400'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                        />
                      </svg>
                      <span className='text-sm font-medium text-yellow-800 dark:text-yellow-300'>
                        ⚠️ 危险操作警告
                      </span>
                    </div>
                    <p className='text-sm text-yellow-700 dark:text-yellow-400'>
                      此操作将重置用户封禁和管理员设置、自定义视频源，站点配置将重置为默认值，是否继续�?                    </p>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={() => setShowResetConfigModal(false)}
                    className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.secondary}`}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmResetConfig}
                    disabled={isLoading('resetConfig')}
                    className={`px-6 py-2.5 text-sm font-medium ${
                      isLoading('resetConfig')
                        ? buttonStyles.disabled
                        : buttonStyles.danger
                    }`}
                  >
                    {isLoading('resetConfig') ? '重置�?..' : '确认重置'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </PageLayout>
  );
}

export default function AdminPage() {
  return (
    <Suspense>
      <AdminPageClient />
    </Suspense>
  );
}
