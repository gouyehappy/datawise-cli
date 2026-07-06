package org.apache.datawise.backend.ai.support;

import org.apache.datawise.backend.ai.domain.AiLlmProfileDto;
import org.apache.datawise.backend.configstore.UserAppConfigStore;
import org.apache.datawise.backend.security.UserContext;
import org.springframework.stereotype.Component;

import java.util.Optional;

/** 从当前用户 app 配置读取默认 LLM。 */
@Component
public class UserAiLlmResolver {

    private final UserAppConfigStore userAppConfigStore;

    public UserAiLlmResolver(UserAppConfigStore userAppConfigStore) {
        this.userAppConfigStore = userAppConfigStore;
    }

    public Optional<AiLlmProfileDto> resolveForCurrentUser() {
        Long userId = UserContext.getUserId();
        if (userId == null || UserContext.isGuest()) {
            return Optional.empty();
        }
        return userAppConfigStore.readAppConfig(userId).flatMap(UserAiPreferencesSupport::readDefaultChatProfile);
    }
}
