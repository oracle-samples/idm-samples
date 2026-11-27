package com.oracle.aiworld.voice.adapter.speech;

import static org.assertj.core.api.Assertions.assertThat;

import com.oracle.bmc.http.client.HttpProvider;
import org.junit.jupiter.api.Test;

class OciHttpProviderCompatibilityTest {

    @Test
    void loadsOciJerseyProviderWithCompatibleRuntimeDependencies() {
        HttpProvider provider = HttpProvider.getDefault();

        assertThat(provider)
                .isNotNull()
                .hasSameClassAs(HttpProvider.getDefault());
        assertThat(provider.getClass().getName())
                .isEqualTo("com.oracle.bmc.http.client.jersey.JerseyHttpProvider");
    }
}
