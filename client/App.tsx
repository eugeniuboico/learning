import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LeaderboardPanel } from './components/LeaderboardPanel';
import { PathCard } from './components/PathCard';
import { RegisterModal } from './components/RegisterModal';
import { LoginModal } from './components/LoginModal';
import { PathDetails } from './components/PathDetails';
import { AddPathModal } from './components/AddPathModal';
import { EditPathModal } from './components/EditPathModal';
import { AlertDialog } from './components/AlertDialog';
import ChatWidget from './components/ChatWidget';
import { SocketProvider } from './contexts/SocketContext';
import { User, Path } from './types';
import { apiUrl } from './config';

const App: React.FC = () => {
  const [paths, setPaths] = useState<Path[]>([]);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isAddPathOpen, setIsAddPathOpen] = useState(false);
  const [isEditPathOpen, setIsEditPathOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<Path | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedPath, setSelectedPath] = useState<Path | null>(null);


  // Alert dialog state

  // Alert dialog state
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'info' | 'success' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info'
  });

  // Fetch paths
  const fetchPaths = async () => {
    try {
      const response = await fetch(apiUrl('/paths'), {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setPaths(data);
      }
    } catch (error) {
      console.error('Failed to fetch paths', error);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchPaths();
    }
  }, [currentUser]);

  // Check for saved user on app load (via API /me)
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch(apiUrl('/me'), {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setCurrentUser(data.user);
        }
        // Silently fail if not authenticated (401 is expected)
      } catch (error) {
        // Network error only
        if (error instanceof Error) {
          console.error('Session check failed', error);
        }
      }
    };

    checkSession();
  }, []);

  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    // Nu mai salvam in localStorage, cookie-ul e setat automat de browser
    setIsLoginOpen(false);
  };

  const handleLogout = async () => {
    try {
      await fetch(apiUrl('/logout'), {
        method: 'POST',
        credentials: 'include'
      });
      setCurrentUser(null);
      setPaths([]);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const handleUnlockPath = async (pathId: string) => {
    try {
      const response = await fetch(apiUrl(`/paths/${pathId}/unlock`), {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        // Refresh paths to update status
        fetchPaths();
        setAlertDialog({
          isOpen: true,
          title: 'Success',
          message: 'Path unlocked successfully! You can now access this course.',
          variant: 'success'
        });
      } else {
        const data = await response.json();
        setAlertDialog({
          isOpen: true,
          title: 'Error',
          message: data.error || 'Failed to unlock path',
          variant: 'danger'
        });
      }
    } catch (error) {
      console.error('Failed to unlock path', error);
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: 'Network error. Please try again.',
        variant: 'danger'
      });
    }
  };

  const handleEditPath = (path: Path) => {
    setEditingPath(path);
    setIsEditPathOpen(true);
  };

  // If not authenticated, show only login/register
  if (!currentUser) {
    return (
      <SocketProvider userId={null}>
        <div className="h-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
          <Navbar
            onOpenRegister={() => setIsRegisterOpen(true)}
            onOpenLogin={() => setIsLoginOpen(true)}
            currentUser={null}
            onLogout={handleLogout}
            onUserUpdated={(u: any) => setCurrentUser(u)}
          />

          <RegisterModal
            isOpen={isRegisterOpen}
            onClose={() => setIsRegisterOpen(false)}
            onSwitchToLogin={() => {
              setIsRegisterOpen(false);
              setIsLoginOpen(true);
            }}
          />
          <LoginModal
            isOpen={isLoginOpen}
            onClose={() => setIsLoginOpen(false)}
            onLoginSuccess={handleLoginSuccess}
            onSwitchToRegister={() => {
              setIsLoginOpen(false);
              setIsRegisterOpen(true);
            }}
          />

          {/* Welcome Screen - Force Login */}
          <div className="flex-grow flex items-center justify-center p-4">
            <div className="text-center max-w-md">
              <h1 className="text-5xl font-extrabold italic text-gray-800 dark:text-gray-100 mb-4">
                Welcome to Learning Platform
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                Please login or register to access your courses and track your progress.
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setIsLoginOpen(true)}
                  className="px-8 py-3 bg-primary text-white font-bold rounded-full hover:bg-primary-dark transition-colors shadow-lg"
                >
                  Login
                </button>
                <button
                  onClick={() => setIsRegisterOpen(true)}
                  className="px-8 py-3 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 font-bold rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-primary transition-colors shadow-lg"
                >
                  Register
                </button>
              </div>
            </div>
          </div>
        </div>
      </SocketProvider>
    );
  }

  return (
    <SocketProvider userId={currentUser?.id || null}>
      <div className="h-screen flex flex-col overflow-hidden">
        <Navbar
          onOpenRegister={() => setIsRegisterOpen(true)}
          onOpenLogin={() => setIsLoginOpen(true)}
          currentUser={currentUser}
          onLogout={handleLogout}
          onUserUpdated={(u: any) => setCurrentUser(u)}
        />

        <RegisterModal
          isOpen={isRegisterOpen}
          onClose={() => setIsRegisterOpen(false)}
          onSwitchToLogin={() => {
            setIsRegisterOpen(false);
            setIsLoginOpen(true);
          }}
        />
        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          onLoginSuccess={handleLoginSuccess}
          onSwitchToRegister={() => {
            setIsLoginOpen(false);
            setIsRegisterOpen(true);
          }}
        />

        <AddPathModal
          isOpen={isAddPathOpen}
          onClose={() => setIsAddPathOpen(false)}
          onSuccess={fetchPaths}
        />

        <EditPathModal
          isOpen={isEditPathOpen}
          path={editingPath}
          onClose={() => {
            setIsEditPathOpen(false);
            setEditingPath(null);
          }}
          onSuccess={fetchPaths}
        />

        <AlertDialog
          isOpen={alertDialog.isOpen}
          title={alertDialog.title}
          message={alertDialog.message}
          variant={alertDialog.variant}
          onConfirm={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        />

        <main className="w-full px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-4 flex-grow overflow-hidden">

          {/* Sidebar - Leaderboard */}
          <LeaderboardPanel />

          {/* Main Content - Paths */}
          <section className="lg:col-span-9 h-full overflow-hidden">
            {selectedPath ? (
              <PathDetails
                path={selectedPath}
                onBack={() => setSelectedPath(null)}
                currentUser={currentUser}
              />
            ) : (
              <div className="bg-card-light dark:bg-card-dark rounded-3xl border border-gray-200 dark:border-gray-700 p-8 h-full shadow-sm relative flex flex-col">
                <h2 className="text-3xl font-extrabold italic text-center mb-10 text-gray-600 dark:text-gray-200 flex-shrink-0">
                  My Paths
                </h2>

                <div className="space-y-6 overflow-y-auto flex-grow pr-2 custom-scrollbar">
                  {paths.map((path) => (
                    <div
                      key={path.id}
                      onClick={() => {
                        // Admin can access all paths, students only in-progress
                        if (currentUser?.role === 'admin' || path.status === 'in-progress') {
                          setSelectedPath(path);
                        }
                      }}
                    >
                      <PathCard
                        path={path}
                        onUnlock={handleUnlockPath}
                        onEdit={handleEditPath}
                        isAdmin={currentUser?.role === 'admin'}
                      />
                    </div>
                  ))}

                  {/* Admin Add Path Button */}
                  {currentUser?.role === 'admin' && (
                    <div
                      className="bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-6 h-32 flex items-center justify-center cursor-pointer hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-700 transition-all group"
                      onClick={() => setIsAddPathOpen(true)}
                    >
                      <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center shadow-md transform group-hover:scale-110 transition-transform">
                        <span className="material-icons text-2xl font-bold">add</span>
                      </div>
                      <span className="ml-4 font-bold text-gray-500 dark:text-gray-400 group-hover:text-primary transition-colors">Create New Path</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

        </main>

        {/* Chat Widget */}
        {currentUser && (
          <ChatWidget currentUserId={currentUser.id} userRole={currentUser.role} />
        )}

        {/* Mobile Menu Button - Bottom Left (Moved for balance if needed, or hide on desktop) */}
        <div className="fixed bottom-6 left-6 lg:hidden z-40">
          <button className="bg-gray-800 text-white rounded-full p-4 shadow-lg transition-colors flex items-center justify-center">
            <span className="material-icons">menu</span>
          </button>
        </div>
      </div>
    </SocketProvider>
  );
};



export default App;
