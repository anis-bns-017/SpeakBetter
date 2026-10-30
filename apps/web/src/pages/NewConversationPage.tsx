import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSearchUsers } from '../hooks/useFriends';
import { useCreatePrivateChat } from '../hooks/useChat';
import { toast } from 'sonner';
import { Search, UserPlus, User, X, ArrowLeft } from 'lucide-react';

export const NewConversationPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const { data: searchResults, isLoading } = useSearchUsers(searchQuery);
  const createChat = useCreatePrivateChat();

  const handleUserSelect = (selectedUser: any) => {
    // Don't select yourself
    if (selectedUser.id === user?.id) return;
    
    // Check if already selected
    if (selectedUsers.some((u) => u.id === selectedUser.id)) {
      setSelectedUsers(selectedUsers.filter((u) => u.id !== selectedUser.id));
      return;
    }
    
    setSelectedUsers([...selectedUsers, selectedUser]);
  };

  const handleStartChat = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Select at least one user to chat with');
      return;
    }

    setIsCreating(true);
    try {
      // For now, only support 1-on-1 chats (multiple will be group)
      if (selectedUsers.length === 1) {
        const chat = await createChat.mutateAsync(selectedUsers[0].id);
        navigate(`/chat/${chat.id}`);
      } else {
        // Create group chat (you can add this later)
        toast.info('Group chat creation coming soon!');
        setIsCreating(false);
      }
    } catch (error) {
      toast.error('Failed to create chat');
      setIsCreating(false);
    }
  };

  // Don't show yourself in search
  const filteredResults = searchResults?.filter((u: any) => u.id !== user?.id) || [];

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold">New Conversation</h1>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-4 py-3">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Selected Users */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedUsers.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm"
            >
              <span>{u.name}</span>
              <button
                onClick={() => handleUserSelect(u)}
                className="hover:bg-blue-200 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={handleStartChat}
            disabled={isCreating || selectedUsers.length === 0}
            className="px-4 py-1.5 bg-blue-500 text-white rounded-full text-sm hover:bg-blue-600 disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : `Start Chat (${selectedUsers.length})`}
          </button>
        </div>
      )}

      {/* Search Results */}
      {searchQuery.length >= 2 && (
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center text-gray-500 py-8">Searching...</div>
          ) : filteredResults.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <User className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p>No users found</p>
              <p className="text-sm">Try a different search term</p>
            </div>
          ) : (
            filteredResults.map((result: any) => {
              const isSelected = selectedUsers.some((u) => u.id === result.id);
              return (
                <div
                  key={result.id}
                  onClick={() => handleUserSelect(result)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold flex-shrink-0">
                    {result.avatarUrl ? (
                      <img src={result.avatarUrl} alt={result.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      result.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{result.name}</div>
                    <div className="text-sm text-gray-500 truncate">{result.email}</div>
                  </div>
                  {isSelected ? (
                    <button className="p-1.5 bg-blue-500 text-white rounded-full">
                      <UserPlus className="w-4 h-4" />
                    </button>
                  ) : (
                    <button className="p-1.5 bg-gray-200 hover:bg-gray-300 rounded-full">
                      <UserPlus className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Empty state */}
      {searchQuery.length < 2 && (
        <div className="text-center py-12">
          <User className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">Search for people to chat with</p>
          <p className="text-sm text-gray-400">Type at least 2 characters</p>
        </div>
      )}
    </div>
  );
};