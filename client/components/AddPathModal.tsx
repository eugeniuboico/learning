import React, { useState } from 'react';
import { apiUrl } from '../config';

interface AddPathModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddPathModal: React.FC<AddPathModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [starsRequired, setStarsRequired] = useState('0');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name.trim()) {
      setError('Path name is required');
      return;
    }

    const starsNum = parseInt(starsRequired) || 0;
    if (starsNum < 0) {
      setError('Stars required must be 0 or greater');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(apiUrl('/paths'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          stars_required: starsNum
        })
      });

      if (response.ok) {
        // Reset form
        setName('');
        setDescription('');
        setStarsRequired('0');
        onSuccess();
        onClose();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create path');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setName('');
      setDescription('');
      setStarsRequired('0');
      setError('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-[600px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-extrabold italic text-gray-800 dark:text-gray-100">
            Create New Path
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
          >
            <span className="material-icons text-3xl">close</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Path Name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              Path Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., React Development"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what students will learn..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
              disabled={isSubmitting}
            />
          </div>

          {/* Stars Required */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              Stars Required to Unlock
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                value={starsRequired}
                onChange={(e) => setStarsRequired(e.target.value)}
                min="0"
                step="1"
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                disabled={isSubmitting}
              />
              <span className="material-icons text-yellow-400 text-2xl">stars</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Set to 0 for paths that are immediately accessible
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors shadow-md disabled:opacity-50 flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <span className="material-icons animate-spin text-xl">refresh</span>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <span className="material-icons text-xl">add</span>
                  <span>Create Path</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

