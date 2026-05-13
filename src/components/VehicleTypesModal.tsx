/**
 * Vehicle Types Modal Component
 * Модальне вікно для відображення типів вантажівок з сайту
 */

import React from 'react';
import { VEHICLE_TYPE_MAPPING } from '../utils/vehicleTypeMapper';

interface VehicleTypesModalProps {
  isOpen: boolean;
  onClose: () => void;
  extensionTypes: string[]; // Типи з extension
}

export const VehicleTypesModal: React.FC<VehicleTypesModalProps> = ({
  isOpen,
  onClose,
  extensionTypes = []
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">🚛 Типи вантажівок з сайту</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {extensionTypes.length > 0 ? (
          <div className="mb-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-green-800 mb-2">
                ✅ Вибрано на platform.trans.eu ({extensionTypes.length}):
              </h3>
            </div>
            
            <div className="space-y-2">
              {extensionTypes.map((type, index) => {
                const apiCode = VEHICLE_TYPE_MAPPING[type];
                
                return (
                  <div
                    key={index}
                    className="flex items-center p-3 bg-green-50 border border-green-200 rounded"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-green-900">{type}</div>
                      <div className="text-xs text-green-600">API код: {apiCode}</div>
                    </div>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      Активний
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-700">
                <strong>ℹ️ Інформація:</strong> Ці типи вантажівок автоматично синхронізуються з вашими налаштуваннями на platform.trans.eu. 
                Щоб змінити типи, оновіть фільтри на основній сторінці сайту.
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-center">
              <div className="text-yellow-800 mb-2">⚠️ Типи вантажівок не знайдено</div>
              <div className="text-sm text-yellow-700">
                Переконайтеся, що ви вибрали типи вантажівок на platform.trans.eu та оновіть фільтри.
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
};