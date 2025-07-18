'use client';

import { Button } from '@heroui/button';
import { Card } from '@heroui/card';
import { Image } from '@heroui/image';
import { Input } from '@heroui/input';
import { addToast } from '@heroui/toast';
import { confetti } from '@tsparticles/confetti';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TransactionButton, useActiveAccount } from 'thirdweb/react';

import type { InventoryItem } from '@/api/inventory';
import {
  type GachaResponse,
  useGachaBuyMutation,
  useGachaMutation,
} from '@/api/inventory';
import { amazoniteTransferContract } from '@/contracts/amazonite';
import { getRarityColor } from '@/lib/consts';

interface GachaProps {
  onRefetchInventory: () => void;
  gachaVouchers: number;
}

const GACHA_PRICE = 80;

const launchConfetti = () => {
  confetti('tsparticles', {
    particleCount: 100,
    spread: 70,
    position: { x: 50, y: 50 },
  });

  // Additional confetti bursts for more celebration
  setTimeout(() => {
    confetti('tsparticles', {
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
    });
  }, 250);

  setTimeout(() => {
    confetti('tsparticles', {
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
    });
  }, 500);
};

function extractRevertReason(errorString: string): string | null {
  const revertReason = JSON.stringify(errorString).match(
    /reverted with reason string '([^']+)'/,
  );
  if (revertReason) {
    return revertReason[1];
  }

  const error = JSON.stringify(errorString).match(/ERC20InsufficientBalance/);
  console.log('error2', JSON.stringify(errorString));
  if (error) {
    return 'Insufficient $AMZ balance';
  }

  return 'Error! Please contact support';
}

export default function Gacha({
  onRefetchInventory,
  gachaVouchers,
}: GachaProps) {
  const { t } = useTranslation();
  const account = useActiveAccount();
  const address = useMemo(() => account?.address, [account]);
  const [gachaResult, setGachaResult] = useState<GachaResponse | null>(null);
  const {
    mutate: gachaMutate,
    isPending,
    data,
    isSuccess,
    isError,
  } = useGachaMutation();
  const [vouchers, setVouchers] = useState(gachaVouchers || 0);
  const [gachaPhase, setGachaPhase] = useState<
    'idle' | 'shaking' | 'open' | 'result'
  >('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const totalCost = quantity * GACHA_PRICE;

  const {
    mutate: gachaBuyMutate,
    isPending: isGachaBuyPending,
    isSuccess: isGachaBuySuccess,
    data: gachaBuyData,
  } = useGachaBuyMutation();

  useEffect(() => {
    setVouchers(gachaVouchers);
  }, [gachaVouchers]);

  useEffect(() => {
    if (!isPending && isSuccess && data) {
      setVouchers((prev) => prev - 1);
      onRefetchInventory();
      setGachaPhase('open');
      launchConfetti();
      setTimeout(() => {
        setGachaPhase('result');
      }, 500);
      setGachaResult(data);
    }
    console.log('isError', isError);
    if (!isPending && isError) {
      setIsLoading(false);
      setGachaPhase('idle');
      addToast({
        title: t('inventory.gacha.errorTitle'),
        description: t('inventory.gacha.errorDescription'),
        color: 'danger',
        variant: 'flat',
      });
    }
  }, [isPending, isSuccess, data, onRefetchInventory, isError, t]);

  useEffect(() => {
    if (!isGachaBuyPending && isGachaBuySuccess && gachaBuyData) {
      setIsLoading(false);
      onRefetchInventory();
      setVouchers((prev) => prev + gachaBuyData.data.gachaQuantity);
      addToast({
        title: t('inventory.gacha.successTitle'),
        description: t('inventory.gacha.successDescription', {
          quantity: gachaBuyData.data.gachaQuantity,
        }),
        color: 'success',
        variant: 'flat',
      });
    }
  }, [
    isGachaBuyPending,
    isGachaBuySuccess,
    gachaBuyData,
    onRefetchInventory,
    t,
  ]);

  const handleGachaPlay = async () => {
    addToast({
      title: t('inventory.gacha.playingToastTitle'),
      description: t('inventory.gacha.playingToastDescription'),
      color: 'warning',
      variant: 'flat',
      timeout: 2000,
    });
    if (vouchers <= 0) return;

    setGachaPhase('shaking');

    gachaMutate();
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Gacha Animation */}
        <div className="bg-indigo-950 p-6 rounded-lg border-2 border-black">
          <h2 className="text-2xl font-bold text-cyan-500 mb-6 mythic-text-shadow">
            {t('inventory.gacha.title')}
          </h2>

          <Card
            className="bg-gray-400/30 border-2 border-black flex items-center justify-center mb-6 py-8"
            radius="lg"
          >
            {(gachaPhase === 'idle' || gachaPhase === 'shaking') && (
              <Image
                src="/assets/images/chest-closed.png"
                alt="Gacha Chest"
                className={`w-48 h-48 object-contain my-[36px] ${gachaPhase === 'shaking' ? 'shake' : ''}`}
                height={192}
                width={192}
              />
            )}

            {gachaPhase === 'open' && (
              <div className="flex items-center justify-center relative my-[36px]">
                <Image
                  src="/assets/images/chest-open.png"
                  alt="Gacha Chest"
                  className={`w-48 h-48 object-contain`}
                  height={192}
                  width={192}
                />
                <div className="light-effect"></div>
              </div>
            )}

            {gachaPhase === 'result' && gachaResult?.data.equipment && (
              <div
                className={`p-8 rounded-lg border-2 ${getRarityColor({
                  metadata: gachaResult.data.equipment,
                } as InventoryItem)}`}
              >
                <Image
                  src={
                    gachaResult.data.equipment.image ||
                    '/assets/images/placeholder.png'
                  }
                  alt={gachaResult.data.equipment.name}
                  className="w-48 h-48 object-contain"
                  height={192}
                  width={192}
                />
              </div>
            )}
          </Card>

          <Button
            onPress={handleGachaPlay}
            isDisabled={vouchers <= 0 || isPending}
            className="border-2 border-black w-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold py-3 px-6 rounded-lg hover:from-cyan-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            size="lg"
          >
            {isPending
              ? t('inventory.gacha.playing')
              : `${t('inventory.gacha.play')} (${vouchers} ${t('inventory.gacha.vouchers')})`}
          </Button>
        </div>

        {/* Gacha Info */}
        <div className="bg-indigo-950 p-6 rounded-lg border-2 border-black flex flex-col">
          <h2 className="text-2xl font-bold text-cyan-500 mb-6 mythic-text-shadow">
            {t('inventory.gacha.info')}
          </h2>

          <div className="flex-1">
            <div className="space-y-4 mb-6">
              <div className="text-sm text-gray-400">
                <div className="mb-4">
                  <h4 className="text-white font-semibold mb-2">
                    {t('inventory.gacha.equipmentTypes')}:
                  </h4>
                  <ul className="grid grid-cols-2 gap-x-8">
                    <li className="flex justify-between">
                      <span>{t('inventory.slots.jetpack')}</span>
                      <span>20%</span>
                    </li>

                    <li className="flex justify-between">
                      <span>{t('inventory.slots.helmet')}</span>
                      <span>17.5%</span>
                    </li>
                    <li className="flex justify-between">
                      <span>{t('inventory.slots.belt')}</span>
                      <span>20%</span>
                    </li>

                    <li className="flex justify-between">
                      <span>{t('inventory.slots.pickaxe')}</span>
                      <span>17.5%</span>
                    </li>
                    <li className="flex justify-between">
                      <span>{t('inventory.slots.armour')}</span>
                      <span>20%</span>
                    </li>
                    <li className="flex justify-between">
                      <span>{t('inventory.slots.trinket')}</span>
                      <span>5%</span>
                    </li>
                  </ul>
                </div>

                <div className="mb-4">
                  <h4 className="text-white font-semibold mb-2">
                    {t('inventory.gacha.rarities')}:
                  </h4>
                  <ul className="grid grid-cols-2 gap-x-8">
                    <li className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="w-3 h-3 bg-emerald-500 rounded-full mr-2"></span>
                        <span>{t('inventory.gacha.uncommon')}</span>
                      </div>
                      <span>65%</span>
                    </li>

                    <li className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="w-3 h-3 bg-violet-500 rounded-full mr-2"></span>
                        <span>{t('inventory.gacha.epic')}</span>
                      </div>
                      <span>4.7%</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="w-3 h-3 bg-cyan-500 rounded-full mr-2"></span>
                        <span>{t('inventory.gacha.rare')}</span>
                      </div>
                      <span>30%</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                        <span>{t('inventory.gacha.legendary')}</span>
                      </div>
                      <span>0.3%</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-2">
                    {t('inventory.gacha.grades')}:
                  </h4>
                  <ul className="grid grid-cols-2 gap-x-8">
                    <li className="flex justify-between">
                      <span>{t('inventory.gacha.gradeC')}</span>
                      <span>50%</span>
                    </li>
                    <li className="flex justify-between">
                      <span>{t('inventory.gacha.gradeA')}</span>
                      <span>7.9%</span>
                    </li>
                    <li className="flex justify-between">
                      <span>{t('inventory.gacha.gradeB')}</span>
                      <span>42%</span>
                    </li>
                    <li className="flex justify-between">
                      <span>{t('inventory.gacha.gradeS')}</span>
                      <span>0.1%</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {/* Quantity Input and Discount Flag */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {t('inventory.gacha.quantity')}
                </label>
                <Input
                  type="number"
                  min="0"
                  max="200"
                  value={quantity.toString()}
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                  className="w-full"
                  classNames={{
                    input: 'text-center text-lg',
                    inputWrapper:
                      'bg-gray-50/80 border-black border-2 rounded-md',
                  }}
                />
              </div>
            </div>

            {/* Buy Vouchers Button */}
            <div className="relative">
              {/* Loading Button (Fake) */}
              <Button
                isDisabled
                className={`border-2 border-black w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-3 px-6 rounded-lg cursor-not-allowed opacity-75 absolute top-0 left-0 transition-opacity duration-200 h-full ${
                  isLoading ? 'opacity-100 z-10' : 'opacity-0 -z-10'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {t('transferTokens.button.processing')}
                </div>
              </Button>

              {/* Real TransactionButton */}
              <TransactionButton
                unstyled
                disabled={!address || isLoading}
                className={`border-2 border-black w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-3 px-6 rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  isLoading ? 'opacity-0' : 'opacity-100'
                }`}
                // @ts-ignore
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                  const confirmed = window.confirm(
                    t('transferTokens.confirmTransaction'),
                  );
                  if (!confirmed) {
                    event.preventDefault();
                  } else {
                    setIsLoading(true);
                  }
                }}
                transaction={() => {
                  return amazoniteTransferContract(BigInt(totalCost * 1e18));
                }}
                onError={(error) => {
                  const revertReason = extractRevertReason(error.message);
                  addToast({
                    title: 'Transaction Error',
                    description: revertReason || 'Unknown error',
                    color: 'danger',
                    variant: 'flat',
                  });
                  setIsLoading(false);
                }}
                onTransactionConfirmed={async (result) => {
                  gachaBuyMutate(result.transactionHash);
                }}
              >
                {`${t('inventory.gacha.buyVouchers')} ${quantity || 0}x${GACHA_PRICE} - ${totalCost || 0} $AMZ`}
              </TransactionButton>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
