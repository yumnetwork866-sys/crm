import type { Request, Response } from 'express';
import { realtimeHub } from '../../services/realtimeHub';
import {
  pauseAiForCustomer,
  resumeAiForCustomer,
  isAiActiveForCustomer,
  isGlobalAiEnabled,
  setGlobalAiEnabled,
} from '../../services/difyService';

/**
 * Toggle AI auto-reply on/off for a specific customer
 */
export async function toggleCustomerAi(req: Request, res: Response) {
  try {
    const { phone, enabled, minutes } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Thiếu số điện thoại khách hàng.' });
    }

    if (enabled) {
      resumeAiForCustomer(phone);
    } else {
      pauseAiForCustomer(phone, typeof minutes === 'number' ? minutes : 0);
    }

    const isActive = isAiActiveForCustomer(phone);
    realtimeHub.broadcast('ai:status', { phone, isAiActive: isActive });
    return res.json({
      success: true,
      phone,
      isAiActive: isActive,
      message: isActive ? 'Đã bật phản hồi AI cho khách hàng.' : 'Đã tạm dừng phản hồi AI cho khách hàng.'
    });
  } catch (error: any) {
    console.error('Error toggling customer AI:', error);
    return res.status(500).json({ error: error.message || 'Lỗi khi cập nhật trạng thái AI.' });
  }
}

/**
 * Get AI auto-reply status for a specific customer
 */
export async function getCustomerAiStatus(req: Request, res: Response) {
  try {
    const phone = req.params.phone || req.query.phone;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Thiếu số điện thoại khách hàng.' });
    }

    const isActive = isAiActiveForCustomer(phone);
    return res.json({
      phone,
      isAiActive: isActive
    });
  } catch (error: any) {
    console.error('Error getting customer AI status:', error);
    return res.status(500).json({ error: error.message || 'Lỗi khi kiểm tra trạng thái AI.' });
  }
}

/** Read the AI auto-reply switch shared by all CRM users. */
export async function getGlobalAiStatus(req: Request, res: Response) {
  try {
    return res.json({ isAiEnabled: await isGlobalAiEnabled() });
  } catch (error: any) {
    console.error('Error getting global AI status:', error);
    return res.status(500).json({ error: error.message || 'Lỗi khi kiểm tra trạng thái AI toàn hệ thống.' });
  }
}

/** Enable or disable AI auto-replies globally for every user and conversation. */
export async function toggleGlobalAi(req: Request, res: Response) {
  try {
    if (typeof req.body?.enabled !== 'boolean') {
      return res.status(400).json({ error: 'Trạng thái AI không hợp lệ.' });
    }
    const isAiEnabled = await setGlobalAiEnabled(req.body.enabled);
    realtimeHub.broadcast('ai:status', { scope: 'global', isAiEnabled });
    return res.json({
      success: true,
      isAiEnabled,
      message: isAiEnabled
        ? 'Đã bật AI tự động cho toàn hệ thống.'
        : 'Đã tắt AI tự động cho toàn hệ thống.',
    });
  } catch (error: any) {
    console.error('Error toggling global AI:', error);
    return res.status(500).json({ error: error.message || 'Lỗi khi cập nhật trạng thái AI toàn hệ thống.' });
  }
}
