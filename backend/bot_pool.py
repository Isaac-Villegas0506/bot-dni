import asyncio
import time
from typing import Optional, List


class BotPool:
    """
    Manages a pool of Telegram bots with concurrency control.
    Prevents multiple users from accessing the same bot simultaneously.
    """
    
    def __init__(self, bot_names: List[str]):
        """
        Initialize bot pool with locks for each bot.
        
        Args:
            bot_names: List of bot usernames (e.g., ['@Infordata1_bot', '@SiriusxData_bot'])
        """
        # Create a lock for each bot
        self.bots = {bot: asyncio.Lock() for bot in bot_names}
        # Track when each bot was last acquired (for timeout monitoring)
        self.bot_acquire_times = {bot: 0 for bot in bot_names}
        print(f"[POOL] BotPool initialized with {len(bot_names)} bots: {', '.join(bot_names)}")
    
    async def acquire_bot(self, bot_list: Optional[List[str]] = None, timeout: float = 5.0) -> Optional[str]:
        """
        Acquire an available bot from the pool.
        
        Args:
            bot_list: Specific bots to try (if None, tries all bots in order)
            timeout: Maximum time to wait for a bot to become available (seconds)
        
        Returns:
            Bot name if acquired, None if timeout
        """
        start_time = time.time()
        bots_to_try = bot_list if bot_list else list(self.bots.keys())
        
        while (time.time() - start_time) < timeout:
            # Try each bot in order
            for bot in bots_to_try:
                if bot not in self.bots:
                    continue
                    
                # Try to acquire lock without blocking
                if self.bots[bot].locked():
                    # Bot is busy, check if it's been locked too long (force release after 8s)
                    acquire_time = self.bot_acquire_times.get(bot, 0)
                    if acquire_time > 0 and (time.time() - acquire_time) > 8:
                        print(f"⚠️ Force releasing {bot} (locked > 8s)")
                        # Don't actually force release here, let the timeout handle it
                    continue
                
                # Try to acquire the lock
                acquired = self.bots[bot].locked() == False
                if not acquired:
                    # Quick check - if we can't get it immediately, skip
                    continue
                
                # Attempt to lock
                try:
                    await asyncio.wait_for(self.bots[bot].acquire(), timeout=0.1)
                    self.bot_acquire_times[bot] = time.time()
                    print(f"🔒 Bot acquired: {bot}")
                    return bot
                except asyncio.TimeoutError:
                    continue
            
            # No bot available, wait a bit before retrying
            await asyncio.sleep(0.5)
        
        print(f"⏰ Timeout: No bot available after {timeout}s")
        return None
    
    async def release_bot(self, bot_name: str):
        """
        Release a bot back to the pool.
        
        Args:
            bot_name: Name of the bot to release
        """
        if bot_name not in self.bots:
            print(f"⚠️ Attempted to release unknown bot: {bot_name}")
            return
        
        if self.bots[bot_name].locked():
            self.bots[bot_name].release()
            self.bot_acquire_times[bot_name] = 0
            print(f"🔓 Bot released: {bot_name}")
        else:
            print(f"⚠️ Attempted to release unlocked bot: {bot_name}")
    
    def get_available_bots(self) -> List[str]:
        """n
        Get list of currently available (unlocked) bots.
        
        Returns:
            List of available bot names
        """
        return [bot for bot, lock in self.bots.items() if not lock.locked()]
    
    def get_pool_status(self) -> dict:
        """
        Get current status of all bots in the pool.
        
        Returns:
            Dictionary with bot status information
        """
        return {
            bot: {
                "locked": lock.locked(),
                "acquire_time": self.bot_acquire_times.get(bot, 0)
            }
            for bot, lock in self.bots.items()
        }

